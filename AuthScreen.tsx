import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from './supabaseClient';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const oauthRedirectUrl = 'com.quitbite.quitbite://login-callback';

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage('Signed in successfully.');
    }

    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectUrl,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    } else if (data?.url) {
      await Linking.openURL(data.url);
    }

    setIsLoading(false);
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setMessage('Check your email to confirm your account.');
    }

    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{mode === 'sign_in' ? 'Welcome back' : 'Create account'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'sign_in'
            ? 'Sign in to track your delivery habits.'
            : 'Create an account to start your delivery reset.'}
        </Text>

        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => setMode('sign_in')}
            style={[styles.modeButton, mode === 'sign_in' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === 'sign_in' && styles.modeButtonTextActive]}>Sign in</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('sign_up')}
            style={[styles.modeButton, mode === 'sign_up' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === 'sign_up' && styles.modeButtonTextActive]}>Create account</Text>
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {message ? <Text style={styles.messageText}>{message}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            onPress={handleGoogleSignIn}
            style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.secondaryButtonText}>Continue with Google</Text>
            )}
          </Pressable>
          {mode === 'sign_in' ? (
            <Pressable
              onPress={handleSignIn}
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSignUp}
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 6,
    color: '#6B7280',
  },
  modeToggle: {
    marginTop: 16,
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: '#111827',
  },
  modeButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  fieldGroup: {
    marginTop: 16,
  },
  label: {
    marginBottom: 6,
    color: '#111827',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 12,
    color: '#B91C1C',
  },
  messageText: {
    marginTop: 12,
    color: '#047857',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
