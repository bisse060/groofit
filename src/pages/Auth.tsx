import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import logoWide from '@/assets/grofit-logo-wide.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (user) {
    navigate('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t('auth.login') + ' successful!');
        }
      } else {
        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }
        
        if (!fullName) {
          toast.error('Please fill in all fields');
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Account created successfully!');
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant={language === 'nl' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLanguage('nl')}
        >
          NL
        </Button>
        <Button
          variant={language === 'en' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLanguage('en')}
        >
          EN
        </Button>
      </div>

      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-6">
          <div className="flex justify-center">
            <img src={logoWide} alt="Grofit" className="h-16 w-auto" />
          </div>
          <div>
            <CardTitle className="text-2xl">
              {isLogin ? t('auth.login') : t('auth.signup')}
            </CardTitle>
            <CardDescription className="mt-2">
              Jouw persoonlijke fitness companion
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.loading') : (isLogin ? t('auth.login') : t('auth.signup'))}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {isLogin ? (
              <>
                {t('auth.noAccount')}{' '}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-primary hover:underline font-semibold"
                >
                  {t('auth.signup')}
                </button>
              </>
            ) : (
              <>
                {t('auth.hasAccount')}{' '}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-primary hover:underline font-semibold"
                >
                  {t('auth.login')}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
