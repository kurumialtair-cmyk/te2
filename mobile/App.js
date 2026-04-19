import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { API_BASE } from './api';

const CATEGORIES = [
  'clothing',
  'bags',
  'shoes',
  'accessories',
  'electronics',
  'other',
];

export default function App() {
  const [category, setCategory] = useState(null);
  const [imageFull, setImageFull] = useState(null);
  const [imageLabel, setImageLabel] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = useCallback(async (slot) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to select images.');
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (pickerResult.canceled) return;
    const uri = pickerResult.assets[0].uri;
    if (slot === 'full') setImageFull(uri);
    else setImageLabel(uri);
  }, []);

  const captureImage = useCallback(async (slot) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to capture images.');
      return;
    }
    const pickerResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (pickerResult.canceled) return;
    const uri = pickerResult.assets[0].uri;
    if (slot === 'full') setImageFull(uri);
    else setImageLabel(uri);
  }, []);

  const estimatePrice = useCallback(async () => {
    if (!category) {
      Alert.alert('Select category', 'Please select an item category first.');
      return;
    }
    if (!imageFull || !imageLabel) {
      Alert.alert('Add images', 'Please add both full item and brand label images.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('image_full', {
        uri: imageFull,
        type: 'image/jpeg',
        name: 'full.jpg',
      });
      formData.append('image_label', {
        uri: imageLabel,
        type: 'image/jpeg',
        name: 'label.jpg',
      });
      const res = await fetch(`${API_BASE}/estimate`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to get estimate. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [category, imageFull, imageLabel]);

  const reset = useCallback(() => {
    setCategory(null);
    setImageFull(null);
    setImageLabel(null);
    setResult(null);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Thrift Price Estimator</Text>
        <Text style={styles.subtitle}>Estimate resale price in PHP from condition & brand</Text>

        <Text style={styles.section}>1. Select item category</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.categoryChip, category === c && styles.categoryChipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.categoryText, category === c && styles.categoryTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>2. Full item image</Text>
        <View style={styles.imageRow}>
          <TouchableOpacity style={styles.imageBox} onPress={() => pickImage('full')}>
            {imageFull ? (
              <Image source={{ uri: imageFull }} style={styles.preview} />
            ) : (
              <Text style={styles.placeholder}>Tap to select or capture</Text>
            )}
          </TouchableOpacity>
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => pickImage('full')}>
              <Text style={styles.btnSecondaryText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => captureImage('full')}>
              <Text style={styles.btnSecondaryText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.section}>3. Brand label image</Text>
        <View style={styles.imageRow}>
          <TouchableOpacity style={styles.imageBox} onPress={() => pickImage('label')}>
            {imageLabel ? (
              <Image source={{ uri: imageLabel }} style={styles.preview} />
            ) : (
              <Text style={styles.placeholder}>Tap to select or capture</Text>
            )}
          </TouchableOpacity>
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => pickImage('label')}>
              <Text style={styles.btnSecondaryText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => captureImage('label')}>
              <Text style={styles.btnSecondaryText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submit, loading && styles.submitDisabled]}
          onPress={estimatePrice}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Get price estimate</Text>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>Estimated price</Text>
            <Text style={styles.resultPrice}>₱ {result.estimated_price_php.toFixed(2)}</Text>
            <Text style={styles.resultMeta}>Condition: {result.condition} · Brand: {result.brand}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.reset} onPress={reset}>
          <Text style={styles.resetText}>Start over</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#eee',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#889',
    marginBottom: 24,
  },
  section: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b8b8d0',
    marginTop: 16,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#2d2d44',
  },
  categoryChipActive: {
    backgroundColor: '#6c5ce7',
  },
  categoryText: {
    color: '#aaa',
    fontSize: 14,
  },
  categoryTextActive: {
    color: '#fff',
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageBox: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
  },
  imageActions: {
    gap: 8,
  },
  btnSecondary: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#2d2d44',
    borderRadius: 8,
  },
  btnSecondaryText: {
    color: '#b8b8d0',
    fontSize: 13,
  },
  submit: {
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  result: {
    marginTop: 24,
    padding: 20,
    borderRadius: 14,
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  resultTitle: {
    color: '#889',
    fontSize: 14,
    marginBottom: 4,
  },
  resultPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: '#a29bfe',
  },
  resultMeta: {
    color: '#889',
    fontSize: 13,
    marginTop: 8,
  },
  reset: {
    marginTop: 20,
    alignSelf: 'center',
  },
  resetText: {
    color: '#6c5ce7',
    fontSize: 15,
  },
});
