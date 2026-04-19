import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { API_BASE } from './api';
import { estimateOfflinePrice } from './offlineEstimator';
import { getBrandsByCategory, getBrandTier } from './brandData';
import { roundPriceForMarketplace } from './priceUtils';

const APP_NAME = 'Privies';
const CATEGORIES = ['clothing', 'bags', 'shoes', 'accessories', 'electronics', 'other'];
const MODES = [
  { id: 'auto', label: 'Auto' },
  { id: 'offline', label: 'Offline only' },
  { id: 'online', label: 'Online only' },
];
const CONDITION_OPTIONS = ['poor', 'fair', 'good', 'excellent'];

export default function App() {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('auto');
  const [category, setCategory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState('unbranded');
  const [manualCondition, setManualCondition] = useState(null);
  const [photoCategoryMatch, setPhotoCategoryMatch] = useState(null);
  const [imageFull, setImageFull] = useState(null);
  const [imageLabel, setImageLabel] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const needsLabelImage = selectedBrand !== 'unbranded';
  const brandOptions = useMemo(() => getBrandsByCategory(category), [category]);

  useEffect(() => {
    const nextBrands = getBrandsByCategory(category);
    if (!nextBrands.includes(selectedBrand)) setSelectedBrand('unbranded');
  }, [category, selectedBrand]);

  const goToStep = useCallback(
    (targetStep) => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      setStep(targetStep);
    },
    [fadeAnim],
  );

  const pickImage = useCallback(async (slot) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to select images.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (picked.canceled) return;
    const uri = picked.assets[0].uri;
    if (slot === 'full') {
      setImageFull(uri);
      setPhotoCategoryMatch(null);
    }
    else setImageLabel(uri);
  }, []);

  const captureImage = useCallback(async (slot) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to capture images.');
      return;
    }
    const captured = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (captured.canceled) return;
    const uri = captured.assets[0].uri;
    if (slot === 'full') {
      setImageFull(uri);
      setPhotoCategoryMatch(null);
    }
    else setImageLabel(uri);
  }, []);

  const applyRoundedResult = useCallback((data) => {
    const rounded = roundPriceForMarketplace(data.estimated_price_php || 0);
    return {
      ...data,
      brand: (data.brand || selectedBrand || 'unbranded').toLowerCase(),
      brand_tier: data.brand_tier || getBrandTier(data.brand || selectedBrand),
      estimated_price_php: Number(rounded.toFixed(2)),
    };
  }, [selectedBrand]);

  const estimateOnline = useCallback(async () => {
    const formData = new FormData();
    formData.append('category', category);
    formData.append('manual_condition', manualCondition || '');
    formData.append('photo_category_match', String(photoCategoryMatch === true));
    formData.append('selected_brand', selectedBrand);
    formData.append('image_full', { uri: imageFull, type: 'image/jpeg', name: 'full.jpg' });
    if (needsLabelImage) {
      formData.append('image_label', { uri: imageLabel, type: 'image/jpeg', name: 'label.jpg' });
    } else {
      formData.append('image_label', { uri: imageFull, type: 'image/jpeg', name: 'label.jpg' });
    }

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
    return applyRoundedResult(data);
  }, [API_BASE, applyRoundedResult, category, imageFull, imageLabel, manualCondition, needsLabelImage, photoCategoryMatch, selectedBrand]);

  const estimatePrice = useCallback(async () => {
    if (!category || !selectedBrand) {
      Alert.alert('Pick details', 'Please choose a category and brand first.');
      return;
    }
    if (!imageFull) {
      Alert.alert('Add image', 'Please add the full item photo first.');
      return;
    }
    if (!manualCondition) {
      Alert.alert('Set condition', 'Please choose the item condition first.');
      return;
    }
    if (photoCategoryMatch !== true) {
      Alert.alert('Retake photo', `Photo does not clearly match "${category}". Please retake the image.`);
      return;
    }
    if (needsLabelImage && !imageLabel) {
      Alert.alert('Add image', 'Please add the brand label photo.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      if (mode === 'offline') {
        const offline = estimateOfflinePrice({
          category,
          imageFullUri: imageFull,
          imageLabelUri: imageLabel,
          selectedBrand,
          manualCondition,
          categoryPhotoConfirmed: photoCategoryMatch === true,
        });
        setResult(offline);
        goToStep(4);
        return;
      }

      const onlineData = await estimateOnline();
      setResult(onlineData);
      goToStep(4);
    } catch (err) {
      if (mode === 'online') {
        Alert.alert(
          'Online estimate failed',
          `${err.message || 'Backend unreachable.'}\n\nSet EXPO_PUBLIC_API_BASE to your backend LAN URL (example: http://192.168.x.x:8000).`,
        );
        return;
      }

      const offline = estimateOfflinePrice({
        category,
        imageFullUri: imageFull,
        imageLabelUri: imageLabel,
        selectedBrand,
        manualCondition,
        categoryPhotoConfirmed: photoCategoryMatch === true,
      });
      setResult(offline);
      goToStep(4);
      Alert.alert('Offline fallback', 'Network/backend unavailable. Offline estimate was used.');
    } finally {
      setLoading(false);
    }
  }, [category, selectedBrand, imageFull, imageLabel, needsLabelImage, manualCondition, photoCategoryMatch, mode, estimateOnline, goToStep]);

  const resetAll = useCallback(() => {
    setStep(1);
    setCategory(null);
    setSelectedBrand('unbranded');
    setManualCondition(null);
    setPhotoCategoryMatch(null);
    setImageFull(null);
    setImageLabel(null);
    setResult(null);
    setLoading(false);
  }, []);

  const header = useMemo(
    () => (
      <View style={styles.headerWrap}>
        <Text style={styles.appName}>{APP_NAME}</Text>
      </View>
    ),
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {header}

        <Animated.View style={{ opacity: fadeAnim }}>
          {step === 1 && (
            <View>
              <Text style={styles.sectionTitle}>Step 1 · Choose category and brand</Text>

              <View style={styles.modeRow}>
                {MODES.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.modeChip, mode === m.id && styles.modeChipActive]}
                    onPress={() => setMode(m.id)}
                  >
                    <Text style={[styles.modeText, mode === m.id && styles.modeTextActive]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Category</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryItem, category === c && styles.categoryItemActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={styles.categoryItemText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {category ? (
                <>
                  <Text style={styles.label}>Brand (tiered by resale value)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRow}>
                    {brandOptions.map((brand) => (
                      <TouchableOpacity
                        key={brand}
                        style={[styles.brandChip, selectedBrand === brand && styles.brandChipActive]}
                        onPress={() => setSelectedBrand(brand)}
                      >
                        <Text style={[styles.brandText, selectedBrand === brand && styles.brandTextActive]}>{brand}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : (
                <Text style={styles.stepHint}>Choose a category first to load relevant brands.</Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (!category || !selectedBrand) && styles.btnDisabled]}
                disabled={!category || !selectedBrand}
                onPress={() => goToStep(2)}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.sectionTitle}>Step 2 · Full item photo</Text>
              <Text style={styles.stepHint}>Capture the entire item to assess condition.</Text>
              <View style={styles.photoCard}>
                <TouchableOpacity style={styles.photoBox} onPress={() => pickImage('full')}>
                  {imageFull ? <Image source={{ uri: imageFull }} style={styles.preview} /> : <Text style={styles.placeholder}>Tap to add full item photo</Text>}
                </TouchableOpacity>
                <View style={styles.photoActions}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage('full')}>
                    <Text style={styles.secondaryBtnText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => captureImage('full')}>
                    <Text style={styles.secondaryBtnText}>Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Condition</Text>
              <View style={styles.modeRow}>
                {CONDITION_OPTIONS.map((cond) => (
                  <TouchableOpacity
                    key={cond}
                    style={[styles.modeChip, manualCondition === cond && styles.modeChipActive]}
                    onPress={() => setManualCondition(cond)}
                  >
                    <Text style={[styles.modeText, manualCondition === cond && styles.modeTextActive]}>{cond}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Does this photo clearly match "{category}"?</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeChip, photoCategoryMatch === true && styles.modeChipActive]}
                  onPress={() => setPhotoCategoryMatch(true)}
                >
                  <Text style={[styles.modeText, photoCategoryMatch === true && styles.modeTextActive]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeChip, photoCategoryMatch === false && styles.modeChipActive]}
                  onPress={() => setPhotoCategoryMatch(false)}
                >
                  <Text style={[styles.modeText, photoCategoryMatch === false && styles.modeTextActive]}>No</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => goToStep(1)}>
                  <Text style={styles.ghostBtnText}>Back</Text>
                </TouchableOpacity>
                {needsLabelImage ? (
                  <TouchableOpacity
                    style={[
                      styles.primaryBtnSmall,
                      (!imageFull || !manualCondition || photoCategoryMatch !== true) && styles.btnDisabled,
                    ]}
                    disabled={!imageFull || !manualCondition || photoCategoryMatch !== true}
                    onPress={() => goToStep(3)}
                  >
                    <Text style={styles.primaryBtnText}>Next</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.primaryBtnSmall,
                      (!imageFull || !manualCondition || photoCategoryMatch !== true || loading) && styles.btnDisabled,
                    ]}
                    disabled={!imageFull || !manualCondition || photoCategoryMatch !== true || loading}
                    onPress={estimatePrice}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Estimate</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.sectionTitle}>Step 3 · Brand label photo</Text>
              <Text style={styles.stepHint}>Capture logo/tag for authenticity signal.</Text>
              <View style={styles.photoCard}>
                <TouchableOpacity style={styles.photoBox} onPress={() => pickImage('label')}>
                  {imageLabel ? <Image source={{ uri: imageLabel }} style={styles.preview} /> : <Text style={styles.placeholder}>Tap to add brand label photo</Text>}
                </TouchableOpacity>
                <View style={styles.photoActions}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage('label')}>
                    <Text style={styles.secondaryBtnText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => captureImage('label')}>
                    <Text style={styles.secondaryBtnText}>Camera</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => goToStep(2)}>
                  <Text style={styles.ghostBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtnSmall, (!imageLabel || loading) && styles.btnDisabled]} disabled={!imageLabel || loading} onPress={estimatePrice}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Estimate</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 4 && result && (
            <View>
              <Text style={styles.sectionTitle}>Step 4 · Price estimate</Text>
              <View style={styles.resultCard}>
                <Text style={styles.resultPrice}>PHP {result.estimated_price_php.toFixed(2)}</Text>
                <Text style={styles.resultMeta}>Category: {category}</Text>
                <Text style={styles.resultMeta}>Brand: {result.brand}</Text>
                <Text style={styles.resultMeta}>Condition: {result.condition}</Text>
                <Text style={styles.resultMeta}>Brand tier: {result.brand_tier || getBrandTier(result.brand)}</Text>
                <Text style={styles.resultMeta}>Engine: {result.engine || 'unknown'}</Text>
                {result.notes ? <Text style={styles.resultNotes}>{result.notes}</Text> : null}
              </View>

              <View style={styles.photoPreviewRow}>
                {imageFull ? <Image source={{ uri: imageFull }} style={styles.resultPreview} /> : null}
                {needsLabelImage && imageLabel ? <Image source={{ uri: imageLabel }} style={styles.resultPreview} /> : null}
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => goToStep(needsLabelImage ? 3 : 2)}>
                  <Text style={styles.ghostBtnText}>Edit photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtnSmall} onPress={resetAll}>
                  <Text style={styles.primaryBtnText}>New estimate</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12061F' },
  scroll: { padding: 20, paddingBottom: 36 },
  headerWrap: { marginBottom: 12, alignItems: 'center' },
  appName: {
    color: '#EAD9FF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: '#A855F7',
    textShadowRadius: 10,
  },
  sectionTitle: { color: '#E5D6FA', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  stepHint: { color: '#B7A6CC', marginBottom: 12 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  modeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#2A1640',
    borderWidth: 1,
    borderColor: '#3D225C',
  },
  modeChipActive: { backgroundColor: '#A855F7', borderColor: '#C084FC' },
  modeText: { color: '#CBB8E6', fontSize: 12 },
  modeTextActive: { color: '#12061F', fontWeight: '700' },
  label: { color: '#D9C8F2', marginBottom: 8, fontWeight: '600' },
  categoryList: { gap: 10, paddingBottom: 4, marginBottom: 12 },
  categoryItem: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#1E0D33',
    borderWidth: 1,
    borderColor: '#35204F',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  categoryItemActive: { borderColor: '#C084FC', backgroundColor: '#2A1246' },
  categoryItemText: { color: '#E7DBFA', fontWeight: '700', textTransform: 'capitalize', fontSize: 15 },
  brandRow: { gap: 8, paddingBottom: 6, marginBottom: 16 },
  brandChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#231137',
    borderWidth: 1,
    borderColor: '#41245E',
  },
  brandChipActive: { borderColor: '#C084FC', backgroundColor: '#351A53' },
  brandText: { color: '#D2C0EB', fontSize: 12 },
  brandTextActive: { color: '#FFF', fontWeight: '700' },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: '#A855F7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnSmall: {
    minWidth: 120,
    backgroundColor: '#A855F7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#12061F', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.45 },
  photoCard: {
    backgroundColor: '#1B0D2D',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3D225C',
  },
  photoBox: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#2C1644',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { color: '#9F89BB', fontSize: 13, textAlign: 'center' },
  photoActions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#5B3682',
    backgroundColor: '#2C1644',
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#D8C6EE', fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 10 },
  ghostBtn: {
    minWidth: 120,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#5B3682',
    alignItems: 'center',
  },
  ghostBtnText: { color: '#D8C6EE', fontWeight: '700' },
  resultCard: {
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#1E0D33',
    borderWidth: 1,
    borderColor: '#4E2B74',
    marginBottom: 14,
  },
  resultPrice: { color: '#EBDFFF', fontSize: 34, fontWeight: '800', marginBottom: 8 },
  resultMeta: { color: '#D8C6EE', marginBottom: 4, textTransform: 'capitalize' },
  resultNotes: { color: '#B7A6CC', marginTop: 6, fontSize: 12 },
  photoPreviewRow: { flexDirection: 'row', gap: 10 },
  resultPreview: { flex: 1, height: 140, borderRadius: 12, backgroundColor: '#2C1644' },
});
