import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/native-compat";
import { useColors } from "@/hooks/useColors";
import { useNutrition, MealType } from "@/contexts/NutritionContext";
import { AuthenticatedApiError, authenticatedJsonRequest } from "@/lib/authenticated-api";
import {
  lookupBarcodeFoodDraft,
  saveCustomFoodDraft,
  type FoodEntryDraft,
} from "@/lib/food-logging-api";
import { impact, notifyError, notifySuccess, selection } from "@/lib/haptics";

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "snacks", label: "Snacks" },
  { value: "dinner", label: "Dinner" },
  { value: "pre_workout", label: "Pre-Workout" },
  { value: "post_workout", label: "Post-Workout" },
];

type FoodAnalysisResult = {
  dishName: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servingGrams?: number;
  ingredients?: string[];
  cuisine?: string;
  confidence?: "high" | "medium" | "low" | string;
  healthTip?: string;
};

type FoodAnalysisDraft = {
  dishName: string;
  servingSize: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  servingGrams: string;
  ingredients: string;
};

function asNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTypedConfidence(confidence: FoodAnalysisResult["confidence"]) {
  return confidence === "high" || confidence === "medium" || confidence === "low"
    ? confidence
    : undefined;
}

export default function AddMealScreen() {
  const router = useRouter();
  const { mealType: initialMealType } = useLocalSearchParams<{ mealType?: string }>();
  const { addFoodEntry } = useNutrition();
  const { getToken } = useAuth();
  const colors = useColors();

  const [mealType, setMealType] = useState<MealType>((initialMealType as MealType) || "lunch");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  const [analysisDraft, setAnalysisDraft] = useState<FoodAnalysisDraft | null>(null);
  const [servings, setServings] = useState("1");
  const [mode, setMode] = useState<"photo" | "manual" | "barcode">("photo");

  const [manualFood, setManualFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    servingSize: "1 serving",
  });
  const [barcodeFood, setBarcodeFood] = useState({
    barcode: "",
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    servingSize: "1 package",
  });
  const [barcodeDraftMeta, setBarcodeDraftMeta] = useState<Partial<FoodEntryDraft>>({});
  const [barcodeLookupState, setBarcodeLookupState] = useState<
    "idle" | "loading" | "found" | "fallback" | "error"
  >("idle");
  const [barcodeLookupMessage, setBarcodeLookupMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisResult) {
      setAnalysisDraft(null);
      return;
    }

    setAnalysisDraft({
      dishName: analysisResult.dishName,
      servingSize: analysisResult.servingSize,
      calories: String(analysisResult.calories),
      protein: String(analysisResult.protein),
      carbs: String(analysisResult.carbs),
      fat: String(analysisResult.fat),
      fiber: String(analysisResult.fiber ?? 0),
      servingGrams: analysisResult.servingGrams ? String(analysisResult.servingGrams) : "",
      ingredients: analysisResult.ingredients?.join(", ") ?? "",
    });
  }, [analysisResult]);

  const pickImage = async (fromCamera: boolean) => {
    impact();
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notifyError();
      Alert.alert(
        "Permission Required",
        "Please grant permission to access your " + (fromCamera ? "camera" : "photo library"),
      );
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.7,
          base64: true,
        });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      selection();
      setImageUri(asset.uri);
      setAnalysisResult(null);
      if (asset.base64) {
        void analyzeFood(asset.base64);
      }
    }
  };

  const getAnalysisFallbackMessage = (error: unknown) => {
    if (error instanceof AuthenticatedApiError) {
      return `${error.message} Please enter details manually.`;
    }

    return "Couldn't analyze the food. Please enter details manually.";
  };

  const analyzeFood = async (base64: string) => {
    setAnalyzing(true);
    try {
      const result = await authenticatedJsonRequest<FoodAnalysisResult>({
        getToken,
        path: "/api/ai/analyze-food",
        method: "POST",
        body: { imageBase64: base64, mimeType: "image/jpeg" },
      });
      setAnalysisResult(result);
      notifySuccess();
    } catch (error) {
      notifyError();
      Alert.alert("Analysis Failed", getAnalysisFallbackMessage(error));
      setMode("manual");
    } finally {
      setAnalyzing(false);
    }
  };

  const persistCustomFoodDraft = (draft: FoodEntryDraft) => {
    void saveCustomFoodDraft({ getToken, draft }).catch((error) => {
      console.warn("Failed to save custom food draft", error);
    });
  };

  const handleAddFromPhoto = async () => {
    if (!analysisResult || !analysisDraft) return;
    impact();
    const s = parseFloat(servings) || 1;
    const ingredients = analysisDraft.ingredients
      .split(",")
      .map((ingredient) => ingredient.trim())
      .filter(Boolean);
    const corrected =
      analysisDraft.dishName !== analysisResult.dishName ||
      analysisDraft.servingSize !== analysisResult.servingSize ||
      asNumber(analysisDraft.calories) !== analysisResult.calories ||
      asNumber(analysisDraft.protein) !== analysisResult.protein ||
      asNumber(analysisDraft.carbs) !== analysisResult.carbs ||
      asNumber(analysisDraft.fat) !== analysisResult.fat ||
      asNumber(analysisDraft.fiber) !== (analysisResult.fiber ?? 0);
    const draft: FoodEntryDraft = {
      foodId: "photo_" + Date.now(),
      name: analysisDraft.dishName.trim() || analysisResult.dishName,
      mealType,
      servings: s,
      servingSize: analysisDraft.servingSize.trim() || analysisResult.servingSize,
      calories: Math.round(asNumber(analysisDraft.calories) * s),
      protein: Math.round(asNumber(analysisDraft.protein) * s * 10) / 10,
      carbs: Math.round(asNumber(analysisDraft.carbs) * s * 10) / 10,
      fat: Math.round(asNumber(analysisDraft.fat) * s * 10) / 10,
      fiber: Math.round(asNumber(analysisDraft.fiber) * s * 10) / 10,
      fromPhoto: true,
      photoUri: imageUri || undefined,
      source: "photo",
      confidence: getTypedConfidence(analysisResult.confidence),
      ingredients,
      servingGrams: asNumber(analysisDraft.servingGrams) || undefined,
      correctionOf: corrected ? analysisResult.dishName : undefined,
      correctedAt: corrected ? Date.now() : undefined,
    };
    await addFoodEntry(draft);
    if (corrected) {
      persistCustomFoodDraft(draft);
    }
    notifySuccess();
    router.back();
  };

  const handleAddManual = async () => {
    if (!manualFood.name || !manualFood.calories) {
      notifyError();
      Alert.alert("Missing Info", "Please enter at least the food name and calories.");
      return;
    }
    impact();
    const draft: FoodEntryDraft = {
      foodId: "manual_" + Date.now(),
      name: manualFood.name,
      mealType,
      servings: 1,
      servingSize: manualFood.servingSize,
      calories: parseInt(manualFood.calories) || 0,
      protein: parseFloat(manualFood.protein) || 0,
      carbs: parseFloat(manualFood.carbs) || 0,
      fat: parseFloat(manualFood.fat) || 0,
      fiber: parseFloat(manualFood.fiber) || 0,
      source: "manual",
      confidence: "medium",
    };
    await addFoodEntry(draft);
    persistCustomFoodDraft(draft);
    notifySuccess();
    router.back();
  };

  const handleBarcodeLookup = async () => {
    const barcode = barcodeFood.barcode.trim();
    if (!barcode) {
      notifyError();
      Alert.alert("Barcode Required", "Enter the barcode number first.");
      return;
    }

    setBarcodeLookupState("loading");
    setBarcodeLookupMessage(null);
    const result = await lookupBarcodeFoodDraft({ getToken, barcode, mealType });
    setBarcodeDraftMeta(result.item);

    if (result.status === "found") {
      setBarcodeFood({
        barcode,
        name: result.item.name,
        calories: String(result.item.calories),
        protein: String(result.item.protein),
        carbs: String(result.item.carbs),
        fat: String(result.item.fat),
        fiber: String(result.item.fiber),
        servingSize: result.item.servingSize,
      });
      setBarcodeLookupState("found");
      setBarcodeLookupMessage(
        `${result.item.provider ?? "Food database"}${result.item.providerCached === false ? " live lookup" : ""}`,
      );
      notifySuccess();
      return;
    }

    setBarcodeFood((current) => ({
      ...current,
      barcode,
      servingSize: current.servingSize || "Nutrition label",
    }));
    setBarcodeLookupState(result.status === "not_found" ? "fallback" : "error");
    setBarcodeLookupMessage(
      result.status === "not_found"
        ? "Not found. Enter the nutrition label manually and we will save it for next time."
        : "Lookup failed. Enter the label manually and continue.",
    );
    notifyError();
  };

  const handleAddBarcode = async () => {
    if (!barcodeFood.barcode || !barcodeFood.name || !barcodeFood.calories) {
      notifyError();
      Alert.alert("Missing Info", "Please enter the barcode, food name, and calories.");
      return;
    }
    impact();
    const draft: FoodEntryDraft = {
      foodId: barcodeDraftMeta.foodId || "label_" + barcodeFood.barcode.trim(),
      name: barcodeFood.name.trim(),
      mealType,
      servings: 1,
      servingSize: barcodeFood.servingSize,
      calories: parseInt(barcodeFood.calories) || 0,
      protein: parseFloat(barcodeFood.protein) || 0,
      carbs: parseFloat(barcodeFood.carbs) || 0,
      fat: parseFloat(barcodeFood.fat) || 0,
      fiber: parseFloat(barcodeFood.fiber) || 0,
      source: barcodeDraftMeta.source || (barcodeLookupState === "found" ? "barcode" : "label"),
      barcode: barcodeFood.barcode.trim(),
      confidence: barcodeDraftMeta.confidence || (barcodeLookupState === "found" ? "high" : "low"),
      brand: barcodeDraftMeta.brand,
      catalogItemId: barcodeDraftMeta.catalogItemId,
      memberFoodItemId: barcodeDraftMeta.memberFoodItemId,
      sourceProductId: barcodeDraftMeta.sourceProductId,
      provider: barcodeDraftMeta.provider,
      providerCached: barcodeDraftMeta.providerCached,
      providerQualityScore: barcodeDraftMeta.providerQualityScore,
      servingGrams: barcodeDraftMeta.servingGrams,
      ingredients: barcodeDraftMeta.ingredients,
      portionOptions: barcodeDraftMeta.portionOptions,
    };
    await addFoodEntry(draft);
    persistCustomFoodDraft(draft);
    notifySuccess();
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeBtn, mode === "photo" && { backgroundColor: colors.primary }]}
              onPress={() => {
                selection();
                setMode("photo");
              }}
            >
              <Feather
                name="camera"
                size={16}
                color={mode === "photo" ? "#fff" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  { color: mode === "photo" ? "#fff" : colors.mutedForeground },
                ]}
              >
                AI Photo
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === "manual" && { backgroundColor: colors.primary }]}
              onPress={() => {
                selection();
                setMode("manual");
              }}
            >
              <Feather
                name="edit-3"
                size={16}
                color={mode === "manual" ? "#fff" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  { color: mode === "manual" ? "#fff" : colors.mutedForeground },
                ]}
              >
                Manual
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === "barcode" && { backgroundColor: colors.primary }]}
              onPress={() => {
                selection();
                setMode("barcode");
              }}
            >
              <Feather
                name="bar-chart-2"
                size={16}
                color={mode === "barcode" ? "#fff" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  { color: mode === "barcode" ? "#fff" : colors.mutedForeground },
                ]}
              >
                Barcode
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Log to</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mealTypePicker}
          >
            {MEAL_TYPES.map((m) => (
              <Pressable
                key={m.value}
                style={[
                  styles.mealTypeChip,
                  {
                    backgroundColor: mealType === m.value ? colors.primary : colors.card,
                    borderColor: mealType === m.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  selection();
                  setMealType(m.value);
                }}
              >
                <Text
                  style={[
                    styles.mealTypeChipText,
                    { color: mealType === m.value ? "#fff" : colors.text },
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {mode === "photo" && (
            <>
              {!imageUri ? (
                <View style={styles.photoPlaceholder}>
                  <View
                    style={[
                      styles.photoBox,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Feather name="image" size={48} color={colors.mutedForeground} />
                    <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>
                      Take a photo or choose from gallery
                    </Text>
                    <View style={styles.photoButtons}>
                      {Platform.OS !== "web" && (
                        <Pressable
                          style={[styles.photoBtn, { backgroundColor: colors.primary }]}
                          onPress={() => pickImage(true)}
                        >
                          <Feather name="camera" size={18} color="#fff" />
                          <Text style={styles.photoBtnText}>Camera</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={[
                          styles.photoBtn,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderWidth: 1,
                          },
                        ]}
                        onPress={() => pickImage(false)}
                      >
                        <Feather name="image" size={18} color={colors.text} />
                        <Text style={[styles.photoBtnText, { color: colors.text }]}>Gallery</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.foodImage} resizeMode="cover" />
                  <Pressable
                    style={[styles.retakeBtn, { backgroundColor: colors.card }]}
                    onPress={() => {
                      selection();
                      setImageUri(null);
                      setAnalysisResult(null);
                    }}
                  >
                    <Feather name="refresh-cw" size={16} color={colors.text} />
                    <Text style={[styles.retakeBtnText, { color: colors.text }]}>Retake</Text>
                  </Pressable>
                </View>
              )}

              {analyzing && (
                <View
                  style={[
                    styles.analyzingCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.analyzingText, { color: colors.text }]}>
                    Analyzing with Gemini AI...
                  </Text>
                  <Text style={[styles.analyzingSubtext, { color: colors.mutedForeground }]}>
                    Identifying dish & calculating nutrition
                  </Text>
                </View>
              )}

              {analysisResult && analysisDraft && !analyzing && (
                <View
                  style={[
                    styles.resultCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.resultHeader}>
                    <View>
                      <Text style={[styles.dishName, { color: colors.text }]}>
                        {analysisDraft.dishName}
                      </Text>
                      <Text style={[styles.cuisine, { color: colors.mutedForeground }]}>
                        {analysisResult.cuisine} · {analysisDraft.servingSize}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.confidenceBadge,
                        {
                          backgroundColor:
                            analysisResult.confidence === "high"
                              ? colors.success + "20"
                              : colors.warning + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confidenceText,
                          {
                            color:
                              analysisResult.confidence === "high"
                                ? colors.success
                                : colors.warning,
                          },
                        ]}
                      >
                        {analysisResult.confidence === "high" ? "✓ Confident" : "~ Estimated"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.macrosGrid}>
                    <View style={[styles.macroItem, { backgroundColor: colors.primary + "15" }]}>
                      <Text style={[styles.macroVal, { color: colors.primary }]}>
                        {Math.round(asNumber(analysisDraft.calories))}
                      </Text>
                      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>
                        kcal
                      </Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.protein + "15" }]}>
                      <Text style={[styles.macroVal, { color: colors.protein }]}>
                        {asNumber(analysisDraft.protein)}g
                      </Text>
                      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>
                        Protein
                      </Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.carbs + "15" }]}>
                      <Text style={[styles.macroVal, { color: colors.carbs }]}>
                        {asNumber(analysisDraft.carbs)}g
                      </Text>
                      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>
                        Carbs
                      </Text>
                    </View>
                    <View style={[styles.macroItem, { backgroundColor: colors.fat + "15" }]}>
                      <Text style={[styles.macroVal, { color: colors.fat }]}>
                        {asNumber(analysisDraft.fat)}g
                      </Text>
                      <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>
                        Fat
                      </Text>
                    </View>
                  </View>
                  {analysisResult.healthTip && (
                    <View style={[styles.tipBox, { backgroundColor: colors.primaryMuted }]}>
                      <Feather name="cpu" size={12} color={colors.primary} />
                      <Text style={[styles.tipText, { color: colors.text }]}>
                        {analysisResult.healthTip}
                      </Text>
                    </View>
                  )}
                  <View style={styles.editGrid}>
                    <View style={styles.field}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                        Food
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={analysisDraft.dishName}
                        onChangeText={(dishName) =>
                          setAnalysisDraft({ ...analysisDraft, dishName })
                        }
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                        Serving
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={analysisDraft.servingSize}
                        onChangeText={(servingSize) =>
                          setAnalysisDraft({ ...analysisDraft, servingSize })
                        }
                      />
                    </View>
                  </View>
                  <View style={styles.macroInputs}>
                    {(
                      [
                        { key: "calories" as const, label: "kcal" },
                        { key: "protein" as const, label: "Protein" },
                        { key: "carbs" as const, label: "Carbs" },
                        { key: "fat" as const, label: "Fat" },
                        { key: "fiber" as const, label: "Fiber" },
                      ] as const
                    ).map(({ key, label }) => (
                      <View key={key} style={styles.macroInput}>
                        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                          {label}
                        </Text>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.border,
                              color: colors.text,
                            },
                          ]}
                          value={analysisDraft[key]}
                          onChangeText={(value) =>
                            setAnalysisDraft({ ...analysisDraft, [key]: value })
                          }
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ))}
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                      Ingredients
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={analysisDraft.ingredients}
                      onChangeText={(ingredients) =>
                        setAnalysisDraft({ ...analysisDraft, ingredients })
                      }
                      placeholder="rice, chicken, oil"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={styles.servingRow}>
                    <Text style={[styles.servingLabel, { color: colors.mutedForeground }]}>
                      Servings:
                    </Text>
                    <TextInput
                      style={[
                        styles.servingInput,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={servings}
                      onChangeText={setServings}
                      keyboardType="decimal-pad"
                    />
                    <Text style={[styles.totalCals, { color: colors.text }]}>
                      = {Math.round(asNumber(analysisDraft.calories) * (parseFloat(servings) || 1))}{" "}
                      kcal
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                    onPress={handleAddFromPhoto}
                  >
                    <Feather name="plus" size={18} color="#fff" />
                    <Text style={styles.addBtnText}>Add to {mealType.replace("_", " ")}</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {mode === "manual" && (
            <View
              style={[
                styles.manualCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Food Name *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="e.g. Dal Makhani"
                  placeholderTextColor={colors.mutedForeground}
                  value={manualFood.name}
                  onChangeText={(v) => setManualFood({ ...manualFood, name: v })}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Serving Size
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="1 bowl (200g)"
                  placeholderTextColor={colors.mutedForeground}
                  value={manualFood.servingSize}
                  onChangeText={(v) => setManualFood({ ...manualFood, servingSize: v })}
                />
              </View>
              <View style={styles.macroInputs}>
                {(
                  [
                    { key: "calories" as const, label: "kcal *" },
                    { key: "protein" as const, label: "Protein (g)" },
                    { key: "carbs" as const, label: "Carbs (g)" },
                    { key: "fat" as const, label: "Fat (g)" },
                    { key: "fiber" as const, label: "Fiber (g)" },
                  ] as const
                ).map(({ key, label }) => (
                  <View key={key} style={[styles.macroInput, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                      {label}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      value={manualFood[key]}
                      onChangeText={(v) => setManualFood({ ...manualFood, [key]: v })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
              <Pressable
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddManual}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Add Food</Text>
              </Pressable>
            </View>
          )}

          {mode === "barcode" && (
            <View
              style={[
                styles.manualCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {(
                [
                  { key: "barcode" as const, label: "Barcode *", placeholder: "890..." },
                  { key: "name" as const, label: "Food Name *", placeholder: "Protein bar" },
                  { key: "servingSize" as const, label: "Serving Size", placeholder: "1 package" },
                ] as const
              ).map(({ key, label, placeholder }) => (
                <View key={key} style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    {label}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    value={barcodeFood[key]}
                    onChangeText={(value) => setBarcodeFood({ ...barcodeFood, [key]: value })}
                    keyboardType={key === "barcode" ? "number-pad" : "default"}
                  />
                </View>
              ))}
              <Pressable
                style={[
                  styles.lookupBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  barcodeLookupState === "loading" && { opacity: 0.72 },
                ]}
                onPress={handleBarcodeLookup}
                disabled={barcodeLookupState === "loading"}
                accessibilityRole="button"
                accessibilityLabel="Look up barcode"
              >
                {barcodeLookupState === "loading" ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Feather name="search" size={16} color={colors.primary} />
                )}
                <Text style={[styles.lookupBtnText, { color: colors.text }]}>
                  {barcodeLookupState === "loading" ? "Looking up..." : "Lookup barcode"}
                </Text>
              </Pressable>
              {barcodeLookupMessage ? (
                <View
                  style={[
                    styles.lookupStatus,
                    {
                      backgroundColor:
                        barcodeLookupState === "found"
                          ? colors.success + "16"
                          : colors.warning + "16",
                    },
                  ]}
                >
                  <Feather
                    name={barcodeLookupState === "found" ? "check-circle" : "alert-circle"}
                    size={14}
                    color={barcodeLookupState === "found" ? colors.success : colors.warning}
                  />
                  <Text style={[styles.lookupStatusText, { color: colors.text }]}>
                    {barcodeLookupMessage}
                  </Text>
                </View>
              ) : null}
              <View style={styles.macroInputs}>
                {(
                  [
                    { key: "calories" as const, label: "kcal *" },
                    { key: "protein" as const, label: "Protein" },
                    { key: "carbs" as const, label: "Carbs" },
                    { key: "fat" as const, label: "Fat" },
                    { key: "fiber" as const, label: "Fiber" },
                  ] as const
                ).map(({ key, label }) => (
                  <View key={key} style={styles.macroInput}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                      {label}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      value={barcodeFood[key]}
                      onChangeText={(value) => setBarcodeFood({ ...barcodeFood, [key]: value })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
              <Pressable
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddBarcode}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Add Barcode Food</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16 },
  modeToggle: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  modeBtnText: { fontSize: 14, fontWeight: "600" },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  mealTypePicker: { gap: 8, paddingVertical: 4 },
  mealTypeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  mealTypeChipText: { fontSize: 13, fontWeight: "500" },
  photoPlaceholder: {},
  photoBox: {
    borderRadius: 16,
    padding: 40,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    gap: 12,
  },
  photoHint: { fontSize: 14, textAlign: "center" },
  photoButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  photoBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  imageContainer: { position: "relative" },
  foodImage: { width: "100%", height: 220, borderRadius: 16 },
  retakeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeBtnText: { fontSize: 13, fontWeight: "600" },
  analyzingCard: { borderRadius: 16, padding: 20, borderWidth: 1, alignItems: "center", gap: 8 },
  analyzingText: { fontSize: 15, fontWeight: "600" },
  analyzingSubtext: { fontSize: 13 },
  resultCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  dishName: { fontSize: 20, fontWeight: "700" },
  cuisine: { fontSize: 13, marginTop: 2 },
  confidenceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confidenceText: { fontSize: 12, fontWeight: "600" },
  macrosGrid: { flexDirection: "row", gap: 8 },
  macroItem: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  macroVal: { fontSize: 18, fontWeight: "700" },
  macroLabel: { fontSize: 11, marginTop: 2 },
  tipBox: { flexDirection: "row", gap: 8, borderRadius: 10, padding: 10, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  servingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  servingLabel: { fontSize: 14 },
  servingInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 70,
    textAlign: "center",
  },
  totalCals: { fontSize: 14, fontWeight: "600" },
  addBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  manualCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  lookupBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  lookupBtnText: { fontSize: 14, fontWeight: "700" },
  lookupStatus: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  lookupStatusText: { flex: 1, fontSize: 13, lineHeight: 18 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  editGrid: { gap: 10 },
  macroInputs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  macroInput: { gap: 6, minWidth: 96, flex: 1 },
});
