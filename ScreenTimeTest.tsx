import { useState } from 'react';
import {
  Alert,
  NativeModules,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { ScreenTimeManager } = NativeModules;

export default function ScreenTimeTest({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<string>('No action yet');
  const [isBlocking, setIsBlocking] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  const handleRequestAuth = async () => {
    try {
      setStatus('Requesting authorization...');
      await ScreenTimeManager.requestAuthorization();
      setStatus('Authorization granted');
    } catch (e: any) {
      setStatus(`Auth failed: ${e?.message ?? e}`);
    }
  };

  const handleSelectApps = async () => {
    try {
      setStatus('Opening app picker...');
      const result = await ScreenTimeManager.selectApps();
      if (result?.cancelled) {
        setStatus('App picker cancelled');
      } else {
        setSelectedCount(result?.count ?? 0);
        setStatus(`Selected ${result?.count ?? 0} apps/categories`);
      }
    } catch (e: any) {
      setStatus(`Select failed: ${e?.message ?? e}`);
    }
  };

  const handleBlockApps = async () => {
    try {
      setStatus('Blocking apps...');
      await ScreenTimeManager.blockApps();
      setIsBlocking(true);
      setStatus('Apps are now BLOCKED');
    } catch (e: any) {
      setStatus(`Block failed: ${e?.message ?? e}`);
    }
  };

  const handleUnblockApps = async () => {
    try {
      setStatus('Unblocking apps...');
      await ScreenTimeManager.unblockApps();
      setIsBlocking(false);
      setStatus('Apps are now UNBLOCKED');
    } catch (e: any) {
      setStatus(`Unblock failed: ${e?.message ?? e}`);
    }
  };

  const handleGetStatus = async () => {
    try {
      const result = await ScreenTimeManager.getBlockStatus();
      setIsBlocking(result?.isBlocking ?? false);
      setSelectedCount(result?.selectedCount ?? 0);
      setStatus(
        `Blocking: ${result?.isBlocking ? 'YES' : 'NO'}, Selected: ${result?.selectedCount ?? 0}`,
      );
    } catch (e: any) {
      setStatus(`Status check failed: ${e?.message ?? e}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Screen Time Test</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.statusText}>{status}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusDetail}>
            Blocking: {isBlocking ? '🔴 Active' : '🟢 Inactive'}
          </Text>
          <Text style={styles.statusDetail}>Selected: {selectedCount}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={handleRequestAuth}>
          <Text style={styles.buttonText}>1. Request Authorization</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleSelectApps}>
          <Text style={styles.buttonText}>2. Select Apps to Block</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.blockButton]} onPress={handleBlockApps}>
          <Text style={[styles.buttonText, styles.blockButtonText]}>3. Block Selected Apps</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.unblockButton]} onPress={handleUnblockApps}>
          <Text style={[styles.buttonText, styles.unblockButtonText]}>4. Unblock All Apps</Text>
        </Pressable>

        <Pressable style={[styles.button, styles.statusButton]} onPress={handleGetStatus}>
          <Text style={styles.buttonText}>5. Check Block Status</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Test flow: Authorize → Select apps → Block → Try opening a blocked app → Unblock
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  backText: {
    fontSize: 18,
    color: '#4A6CF7',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  statusCard: {
    backgroundColor: '#F5F5FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0F0',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A6CF7',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusDetail: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    gap: 12,
  },
  button: {
    backgroundColor: '#F0F0F5',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E0E0E8',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  blockButton: {
    backgroundColor: '#FFF0F0',
    borderColor: '#FFD0D0',
  },
  blockButtonText: {
    color: '#D32F2F',
  },
  unblockButton: {
    backgroundColor: '#F0FFF0',
    borderColor: '#D0FFD0',
  },
  unblockButtonText: {
    color: '#2E7D32',
  },
  statusButton: {
    backgroundColor: '#F0F5FF',
    borderColor: '#D0E0FF',
  },
  hint: {
    marginTop: 24,
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
