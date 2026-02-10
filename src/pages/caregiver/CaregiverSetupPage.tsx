import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, User } from 'lucide-react';
import { createCaregiver, getCaregiverByProfileId } from '@/db/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/db/supabase';

export default function CaregiverSetupPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });

  useEffect(() => {
    // Check if caregiver profile already exists
    const checkExistingCaregiver = async () => {
      if (profile) {
        const caregiver = await getCaregiverByProfileId(profile.id);
        if (caregiver) {
          navigate('/caregiver/dashboard', { replace: true });
        }
      }
    };
    checkExistingCaregiver();
  }, [profile, navigate]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleComplete = async () => {
    if (!profile) {
      setError('No profile found. Please log in again.');
      return;
    }
    
    if (!formData.full_name.trim()) {
      setError('Please enter your full name');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('🚀 Starting caregiver setup...');
      console.log('Profile ID:', profile.id);
      console.log('Full name:', formData.full_name);
      
      // Create caregiver record
      console.log('📝 Creating caregiver record...');
      const caregiver = await createCaregiver({
        profile_id: profile.id,
        full_name: formData.full_name.trim(),
        phone: formData.phone?.trim() || null,
      });
      
      console.log('✅ Caregiver creation result:', caregiver);
      
      if (!caregiver) {
        console.error('❌ Caregiver creation returned null');
        
        // Check auth state
        const { data: { user } } = await supabase.auth.getUser();
        console.error('Current auth user:', user?.id);
        console.error('Profile ID:', profile.id);
        console.error('Match?', user?.id === profile.id);
        
        setError(`Failed to create caregiver profile. Please try again or contact support.`);
        setLoading(false);
        return;
      }
      
      // Refresh profile to get the latest data
      console.log('🔄 Refreshing profile...');
      await refreshProfile();
      
      console.log('✅ Setup complete! Navigating to dashboard...');
      // Pass caregiver data to dashboard to avoid race condition
      navigate('/caregiver/dashboard', { 
        replace: true,
        state: { caregiverCreated: true }
      });
    } catch (err) {
      console.error('❌ Error in handleComplete:', err);
      setError(`An error occurred during setup: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      {!profile ? (
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading profile...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-6 h-6 text-secondary" />
              <CardTitle>Caregiver Setup</CardTitle>
            </div>
            <CardDescription>
              Let's set up your RemZy caregiver profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-base">What is your full name?</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className="pl-10 text-lg h-14"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-base">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="text-lg h-14"
                />
              </div>
              
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Note:</strong> You can link to patient devices from your dashboard after completing setup
                </p>
              </div>
              
              <Button 
                onClick={handleComplete} 
                className="w-full h-14 text-lg" 
                disabled={!formData.full_name || loading}
              >
                {loading ? 'Setting up...' : 'Complete Setup'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
