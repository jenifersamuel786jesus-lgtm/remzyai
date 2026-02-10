# Alert System Quick Reference

## Current Status
✅ **FULLY OPERATIONAL**

### Statistics
- Total Alerts: 3
- Unread: 2
- Read: 1
- Caregivers Receiving Alerts: 2
- Patients with Alerts: 2

## Alert Types
1. `emergency` - Emergency situations requiring immediate attention
2. `task_skipped` - Patient missed a scheduled task
3. `unknown_person` - Unknown person detected near patient
4. `health_abnormal` - Abnormal health metrics detected
5. `safe_area_breach` - Patient left designated safe area

## Alert Status Flow
```
unread → read → resolved
```

## Creating Alerts (Patient Side)

### Example: Emergency Alert
```typescript
import { createAlert } from '@/db/api';

await createAlert({
  patient_id: patient.id,
  alert_type: 'emergency',
  title: 'Emergency Alert',
  message: 'Patient needs immediate assistance!',
  alert_status: 'unread',
  location_lat: 37.7749,
  location_lng: -122.4194,
  metadata: { 
    caregiver_id: caregiver.id,
    device_info: 'iPhone 12'
  }
});
```

### Required Fields
- `patient_id` - UUID of the patient
- `alert_type` - One of the 5 alert types
- `message` - Alert message text

### Optional Fields
- `title` - Short summary (recommended)
- `alert_status` - Default: 'unread'
- `location_lat` - GPS latitude
- `location_lng` - GPS longitude
- `metadata` - Additional JSON data

## Fetching Alerts (Caregiver Side)

### Get All Alerts for Caregiver
```typescript
import { getCaregiverAlerts } from '@/db/api';

const alerts = await getCaregiverAlerts(caregiverId, 50);
// Returns alerts from all linked patients
```

### Get Unread Count
```typescript
import { getUnreadAlertsCount } from '@/db/api';

const count = await getUnreadAlertsCount(patientId);
```

## Updating Alert Status

### Mark as Read
```typescript
import { updateAlert } from '@/db/api';

await updateAlert(alertId, {
  alert_status: 'read'
});
// Automatically sets is_read = true and read_at = NOW()
```

### Mark as Resolved
```typescript
await updateAlert(alertId, {
  alert_status: 'resolved'
});
// Automatically sets is_read = true and read_at = NOW()
```

## Database Schema

### Alerts Table
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'emergency', 'task_skipped', 'unknown_person', 
    'health_abnormal', 'safe_area_breach'
  )),
  message TEXT NOT NULL,
  title TEXT,
  alert_status TEXT NOT NULL DEFAULT 'unread' CHECK (
    alert_status IN ('unread', 'read', 'resolved')
  ),
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Indexes
- `idx_alerts_status` - Fast queries by status
- `idx_alerts_patient_status` - Fast queries by patient and status

### Automatic Triggers
- `sync_alert_read_status` - Keeps is_read in sync with alert_status

## Alert Visibility Rules

### Who Can See What
1. **Patients** - Can see their own alerts
2. **Caregivers** - Can see alerts from linked patients only
3. **Admins** - Can see all alerts (if admin role implemented)

### Linking Logic
```
Alert → Patient → Device Link → Caregiver
```

An alert is visible to a caregiver if:
- Alert belongs to a patient
- Patient is linked to caregiver via device_links
- Device link is active (is_active = true)

## Common Queries

### Get Alerts for Specific Caregiver
```sql
WITH linked_patients AS (
  SELECT patient_id
  FROM device_links
  WHERE caregiver_id = ? AND is_active = true
)
SELECT a.*, p.full_name as patient_name
FROM alerts a
JOIN patients p ON a.patient_id = p.id
WHERE a.patient_id IN (SELECT patient_id FROM linked_patients)
ORDER BY a.created_at DESC;
```

### Get Unread Alert Count
```sql
SELECT COUNT(*)
FROM alerts
WHERE patient_id = ? AND alert_status = 'unread';
```

### Mark Alert as Read
```sql
UPDATE alerts
SET alert_status = 'read'
WHERE id = ?;
-- Trigger automatically sets is_read = true and read_at = NOW()
```

## Troubleshooting

### Alert Not Showing for Caregiver
1. Check if device link exists and is active:
```sql
SELECT * FROM device_links
WHERE patient_id = ? AND caregiver_id = ? AND is_active = true;
```

2. Check if alert exists:
```sql
SELECT * FROM alerts WHERE patient_id = ?;
```

3. Check if caregiver query is correct:
```sql
-- Should return the alert
SELECT a.* FROM alerts a
JOIN device_links dl ON dl.patient_id = a.patient_id
WHERE dl.caregiver_id = ? AND dl.is_active = true;
```

### Alert Creation Fails
1. Check alert_type is valid (one of 5 types)
2. Check patient_id exists in patients table
3. Check message is not empty
4. Check for database errors in console

### Status Not Updating
1. Verify trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_alert_read_status';
```

2. Check trigger function:
```sql
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'sync_alert_read_status';
```

## Best Practices

### 1. Always Include Title
```typescript
// ✅ Good
createAlert({
  title: 'Emergency Alert',
  message: 'Patient fell down'
});

// ❌ Bad
createAlert({
  message: 'Patient fell down'
});
```

### 2. Include Location When Available
```typescript
// ✅ Good
createAlert({
  location_lat: position.coords.latitude,
  location_lng: position.coords.longitude
});
```

### 3. Use Metadata for Additional Context
```typescript
// ✅ Good
createAlert({
  metadata: {
    caregiver_id: caregiver.id,
    device_type: 'mobile',
    battery_level: 85
  }
});
```

### 4. Handle Errors Gracefully
```typescript
// ✅ Good
try {
  const alert = await createAlert(alertData);
  if (!alert) {
    console.error('Failed to create alert');
    toast.error('Could not send alert');
  }
} catch (error) {
  console.error('Error creating alert:', error);
  toast.error('Error sending alert');
}
```

## Testing

### Create Test Alert
```sql
INSERT INTO alerts (
  patient_id, alert_type, title, message, alert_status
) VALUES (
  'patient-uuid', 'emergency', 'Test Alert', 
  'This is a test alert', 'unread'
);
```

### Verify Caregiver Can See It
```sql
SELECT a.*, p.full_name
FROM alerts a
JOIN patients p ON a.patient_id = p.id
JOIN device_links dl ON dl.patient_id = p.id
WHERE dl.caregiver_id = 'caregiver-uuid' AND dl.is_active = true;
```

### Clean Up Test Data
```sql
DELETE FROM alerts WHERE title = 'Test Alert';
```

## Summary

✅ Alert system is fully functional
✅ Caregivers receive alerts from linked patients
✅ Status updates work automatically
✅ Location tracking supported
✅ Metadata for additional context
✅ Proper error handling in place

For more details, see ALERT_SYSTEM_FIX.md
