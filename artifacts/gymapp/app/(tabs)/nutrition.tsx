import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "@/components/native-compat";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useTypography } from "@/hooks/useTypography";
import { useDebounce } from "@/hooks/useDebounce";
import { useApp } from "@/contexts/AppContext";
import { useNutrition, MealType, type FoodEntry } from "@/contexts/NutritionContext";
import { MacroRing } from "@/components/MacroRing";
import { MacroBar } from "@/components/MacroBar";
import { FOOD_CATEGORIES, INDIAN_FOODS, searchFoods, type FoodItem } from "@/constants/indianFoods";
import {
  foodSearchItemToEntryDraft,
  searchFoodDrafts,
  type FoodEntryDraft,
  type FoodSearchItem,
} from "@/lib/food-logging-api";
import { impact, notifySuccess, notifyWarning, selection } from "@/lib/haptics";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const MEAL_SECTIONS: { type: MealType; label: string; icon: FeatherIconName; color: string }[] = [
  { type: "breakfast", label: "Breakfast", icon: "sun", color: "#F59E0B" },
  { type: "lunch", label: "Lunch", icon: "coffee", color: "#22C55E" },
  { type: "snacks", label: "Snacks", icon: "package", color: "#3B82F6" },
  { type: "dinner", label: "Dinner", icon: "moon", color: "#8B5CF6" },
  { type: "pre_workout", label: "Pre-Workout", icon: "zap", color: "#FF6B00" },
  { type: "post_workout", label: "Post-Workout", icon: "activity", color: "#14B8A6" },
];

const FEATURED_BROWSE_FOOD_IDS = [
  "roti",
  "basmati_rice",
  "dal_tadka",
  "paneer_bhurji",
  "chicken_biryani",
  "idli",
  "poha",
  "boiled_egg",
  "curd",
  "banana",
  "protein_shake",
  "oats",
];

function getBrowseFoods(): FoodItem[] {
  const foodsById = new Map(INDIAN_FOODS.map((food) => [food.id, food]));
  const featuredFoods = FEATURED_BROWSE_FOOD_IDS.flatMap((id) => {
    const food = foodsById.get(id);
    return food ? [food] : [];
  });
  const featuredIds = new Set(featuredFoods.map((food) => food.id));
  return [...featuredFoods, ...INDIAN_FOODS.filter((food) => !featuredIds.has(food.id))];
}

function localFoodToSearchItem(food: FoodItem): FoodSearchItem {
  return {
    id: `local-${food.id}`,
    source: "curated",
    sourceProductId: food.id,
    name: food.name,
    servingLabel: food.servingSize,
    servingGrams: food.servingGrams,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    ingredients: [],
    allergens: [],
    portionOptions: [
      {
        label: food.servingSize,
        grams: food.servingGrams,
        region: food.cuisine === "Indian" || !food.cuisine ? "IN" : food.cuisine,
        ...(food.aliases?.length ? { aliases: food.aliases } : {}),
      },
    ],
    confidence: "medium",
    provenance: { provider: "local-food-catalog", cached: true, qualityScore: 55 },
  };
}

function getFoodSourceLabel(food: FoodEntryDraft): string {
  if (food.provider) return food.provider.replace(/[-_]/g, " ");
  if (food.source === "recent") return "recent";
  return food.source ?? "search";
}

function MacroPill({
  label,
  value,
  target,
  color,
  size = 72,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  size?: number;
}) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / Math.max(target, 1), 1);
  const strokeDashoffset = circumference * (1 - progress);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View
      style={[
        macroPillStyles.container,
        { backgroundColor: color + "15", borderColor: color + "30" },
      ]}
    >
      <View
        style={{
          position: "relative",
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={radius} stroke={color + "30"} strokeWidth={5} fill="none" />
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={5}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </Svg>
        <View style={{ position: "absolute", alignItems: "center" }}>
          <Text style={[macroPillStyles.value, { color }]}>{Math.round(value)}</Text>
          <Text style={[macroPillStyles.unit, { color }]}>g</Text>
        </View>
      </View>
      <View style={macroPillStyles.labelRow}>
        <Text style={[macroPillStyles.label, { color }]}>{label}</Text>
        <Text style={[macroPillStyles.target, { color: color + "80" }]}>/{target}g</Text>
      </View>
    </View>
  );
}

const macroPillStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    gap: 6,
    flex: 1,
  },
  value: { fontSize: 14, fontWeight: "800" },
  unit: { fontSize: 9, fontWeight: "600", marginTop: -2 },
  labelRow: { flexDirection: "row", alignItems: "baseline", gap: 1 },
  label: { fontSize: 12, fontWeight: "700" },
  target: { fontSize: 10 },
});

export default function NutritionScreen() {
  const { profile } = useApp();
  const { todayLog, addFoodEntry, removeFoodEntry, updateWaterIntake, getRecentFoodEntries } =
    useNutrition();
  const router = useRouter();
  const { getToken } = useAuth();
  const colors = useColors();
  const typography = useTypography();
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery);
  const [selectedFood, setSelectedFood] = useState<FoodEntryDraft | null>(null);
  const [servings, setServings] = useState("1");
  const [apiFoodResults, setApiFoodResults] = useState<FoodEntryDraft[]>([]);
  const [foodSearchState, setFoodSearchState] = useState<"idle" | "loading" | "api" | "fallback">(
    "idle",
  );
  const [foodSearchError, setFoodSearchError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return todayLog.entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
        fiber: acc.fiber + e.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
  }, [todayLog.entries]);

  const localSearchItems = useMemo(() => {
    const foods =
      debouncedSearchQuery.length > 0 ? searchFoods(debouncedSearchQuery) : getBrowseFoods();
    return foods.map(localFoodToSearchItem);
  }, [debouncedSearchQuery]);
  const localSearchDrafts = useMemo(
    () =>
      localSearchItems.map((food) =>
        foodSearchItemToEntryDraft(food, activeMeal ?? "lunch", 1, "search"),
      ),
    [activeMeal, localSearchItems],
  );
  const searchResults =
    apiFoodResults.length > 0 || foodSearchState === "fallback"
      ? apiFoodResults
      : localSearchDrafts;
  const recentFoodEntries = useMemo(() => getRecentFoodEntries(8), [getRecentFoodEntries]);

  useEffect(() => {
    if (!showFoodSearch || !activeMeal) {
      return;
    }

    const query = debouncedSearchQuery.trim();
    if (query.length < 2) {
      setApiFoodResults([]);
      setFoodSearchState("idle");
      setFoodSearchError(null);
      return;
    }

    let cancelled = false;
    setFoodSearchState("loading");
    setFoodSearchError(null);
    void searchFoodDrafts({
      getToken,
      query,
      mealType: activeMeal,
      limit: 20,
      fallbackItems: localSearchItems.slice(0, 20),
    }).then((result) => {
      if (cancelled) return;
      setApiFoodResults(result.items);
      setFoodSearchState(result.source);
      setFoodSearchError(result.error ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [activeMeal, debouncedSearchQuery, getToken, localSearchItems, showFoodSearch]);

  const handleAddFood = async () => {
    if (!selectedFood || !activeMeal) return;
    impact();
    const s = parseFloat(servings) || 1;
    await addFoodEntry({
      foodId: selectedFood.foodId,
      name: selectedFood.name,
      mealType: activeMeal,
      servings: s,
      servingSize: selectedFood.servingSize,
      calories: Math.round(selectedFood.calories * s),
      protein: Math.round(selectedFood.protein * s * 10) / 10,
      carbs: Math.round(selectedFood.carbs * s * 10) / 10,
      fat: Math.round(selectedFood.fat * s * 10) / 10,
      fiber: Math.round(selectedFood.fiber * s * 10) / 10,
      source: selectedFood.source ?? "search",
      confidence: selectedFood.confidence,
      ingredients: selectedFood.ingredients,
      servingGrams: selectedFood.servingGrams,
      barcode: selectedFood.barcode,
      brand: selectedFood.brand,
      catalogItemId: selectedFood.catalogItemId,
      memberFoodItemId: selectedFood.memberFoodItemId,
      sourceProductId: selectedFood.sourceProductId,
      provider: selectedFood.provider,
      providerCached: selectedFood.providerCached,
      providerQualityScore: selectedFood.providerQualityScore,
      portionOptions: selectedFood.portionOptions,
    });
    setShowFoodSearch(false);
    setSelectedFood(null);
    setSearchQuery("");
    setServings("1");
    notifySuccess();
  };

  const handleRelogFood = async (entry: FoodEntry) => {
    if (!activeMeal) return;
    impact();
    await addFoodEntry({
      foodId: entry.foodId,
      name: entry.name,
      mealType: activeMeal,
      servings: entry.servings,
      servingSize: entry.servingSize,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      fiber: entry.fiber,
      source: "recent",
      confidence: entry.confidence,
      ingredients: entry.ingredients,
      servingGrams: entry.servingGrams,
      barcode: entry.barcode,
      brand: entry.brand,
      catalogItemId: entry.catalogItemId,
      memberFoodItemId: entry.memberFoodItemId,
      sourceProductId: entry.sourceProductId,
      provider: entry.provider,
      providerCached: entry.providerCached,
      providerQualityScore: entry.providerQualityScore,
      portionOptions: entry.portionOptions,
      relogOf: entry.id,
    });
    setShowFoodSearch(false);
    setSelectedFood(null);
    setSearchQuery("");
    notifySuccess();
  };

  const getEntriesForMeal = (type: MealType) => todayLog.entries.filter((e) => e.mealType === type);

  const handleWaterToggle = (glasses: number) => {
    selection();
    updateWaterIntake(todayLog.waterIntake === glasses ? glasses - 1 : glasses);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, styles.webFrame]}>
        <Text style={[styles.screenTitle, typography.screenTitle, { color: colors.text }]}>
          Nutrition
        </Text>
        <Pressable
          style={[styles.cameraBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            impact();
            router.push("/add-meal");
          }}
          accessibilityRole="button"
          accessibilityLabel="Log food with AI photo analysis"
          accessibilityHint="Opens the meal photo analysis screen"
        >
          <Feather name="camera" size={18} color="#fff" />
          <Text style={styles.cameraBtnText}>AI Photo Log</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          styles.webFrame,
          { paddingBottom: TAB_BAR_HEIGHT + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.ringRow}>
            <MacroRing
              calories={totals.calories}
              target={profile.dailyCalorieTarget}
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
              size={140}
            />
            <View style={styles.macroSummary}>
              <MacroBar
                protein={totals.protein}
                carbs={totals.carbs}
                fat={totals.fat}
                proteinTarget={profile.dailyProteinTarget}
                carbTarget={profile.dailyCarbTarget}
                fatTarget={profile.dailyFatTarget}
              />
            </View>
          </View>

          <View style={styles.macroPills}>
            <MacroPill
              label="P"
              value={totals.protein}
              target={profile.dailyProteinTarget}
              color={colors.protein}
            />
            <MacroPill
              label="C"
              value={totals.carbs}
              target={profile.dailyCarbTarget}
              color={colors.carbs}
            />
            <MacroPill
              label="F"
              value={totals.fat}
              target={profile.dailyFatTarget}
              color={colors.fat}
            />
          </View>
        </View>

        <View
          style={[styles.waterCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.waterHeader}>
            <Feather name="droplet" size={16} color={colors.info} />
            <Text style={[styles.waterTitle, { color: colors.text }]}>Water Intake</Text>
            <Text style={[styles.waterCount, { color: colors.info }]}>
              {todayLog.waterIntake}/8 glasses
            </Text>
          </View>
          <View style={styles.waterGlasses}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Pressable
                key={i}
                onPress={() => handleWaterToggle(i + 1)}
                style={[
                  styles.waterGlass,
                  { backgroundColor: i < todayLog.waterIntake ? colors.info : colors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Set water intake to ${i + 1} glass${i === 0 ? "" : "es"}`}
                accessibilityState={{ selected: i < todayLog.waterIntake }}
              >
                <Feather
                  name="droplet"
                  size={14}
                  color={i < todayLog.waterIntake ? "#fff" : colors.mutedForeground}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {MEAL_SECTIONS.map((meal) => {
          const entries = getEntriesForMeal(meal.type);
          const mealCals = entries.reduce((sum, e) => sum + e.calories, 0);
          return (
            <View
              key={meal.type}
              style={[
                styles.mealSection,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderLeftColor: meal.color,
                  borderLeftWidth: 4,
                },
              ]}
            >
              <Pressable
                style={styles.mealHeader}
                onPress={() => {
                  impact();
                  setActiveMeal(meal.type);
                  setShowFoodSearch(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Add food to ${meal.label}`}
                accessibilityHint={`${mealCals} calories logged in this meal`}
              >
                <View style={styles.mealTitleRow}>
                  <View style={[styles.mealIconBg, { backgroundColor: meal.color + "20" }]}>
                    <Feather name={meal.icon} size={14} color={meal.color} />
                  </View>
                  <Text style={[styles.mealTitle, typography.sectionTitle, { color: colors.text }]}>
                    {meal.label}
                  </Text>
                  {mealCals > 0 && (
                    <View style={[styles.mealCalsBadge, { backgroundColor: meal.color + "20" }]}>
                      <Text style={[styles.mealCals, { color: meal.color }]}>{mealCals} kcal</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.addBtn, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="plus" size={18} color={colors.primary} />
                </View>
              </Pressable>
              {entries.map((entry) => (
                <View key={entry.id} style={[styles.foodEntry, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.foodName, { color: colors.text }]}>{entry.name}</Text>
                    <Text style={[styles.foodMeta, { color: colors.mutedForeground }]}>
                      {entry.servingSize} · P:{entry.protein}g C:{entry.carbs}g F:{entry.fat}g
                    </Text>
                    {entry.source ? (
                      <Text style={[styles.foodSource, { color: colors.mutedForeground }]}>
                        {entry.source}
                        {entry.confidence ? ` · ${entry.confidence}` : ""}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.calorieChip, { backgroundColor: meal.color + "18" }]}>
                    <Text style={[styles.calorieChipText, { color: meal.color }]}>
                      {entry.calories}
                    </Text>
                    <Text style={[styles.calorieChipUnit, { color: meal.color + "90" }]}>kcal</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      notifyWarning();
                      removeFoodEntry(entry.id);
                    }}
                    style={styles.deleteBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.name}`}
                  >
                    <Feather name="trash-2" size={14} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showFoodSearch} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add to {MEAL_SECTIONS.find((m) => m.type === activeMeal)?.label}
            </Text>
            <Pressable
              onPress={() => {
                impact();
                setShowFoodSearch(false);
                setSelectedFood(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close food search"
            >
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View
            style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search foods, brands, roti, oats..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              accessibilityLabel="Search foods"
            />
          </View>
          {selectedFood ? (
            <View
              style={[
                styles.selectedFoodCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.selectedFoodName, { color: colors.text }]}>
                {selectedFood.name}
              </Text>
              <Text style={[styles.selectedFoodMeta, { color: colors.mutedForeground }]}>
                {selectedFood.servingSize} · {selectedFood.calories} kcal · P:{selectedFood.protein}
                g C:{selectedFood.carbs}g F:{selectedFood.fat}g
              </Text>
              <Text style={[styles.selectedFoodSource, { color: colors.mutedForeground }]}>
                {getFoodSourceLabel(selectedFood)}
                {selectedFood.confidence ? ` · ${selectedFood.confidence}` : ""}
                {selectedFood.providerCached === false ? " · live lookup" : ""}
              </Text>
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
                  accessibilityLabel={`Servings for ${selectedFood.name}`}
                />
                <Text style={[styles.servingTotal, { color: colors.text }]}>
                  = {Math.round(selectedFood.calories * (parseFloat(servings) || 1))} kcal
                </Text>
              </View>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    selection();
                    setSelectedFood(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Back to food search results"
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Back</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalBtn,
                    { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={handleAddFood}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${selectedFood.name} to ${MEAL_SECTIONS.find((m) => m.type === activeMeal)?.label}`}
                >
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>Add Food</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {!debouncedSearchQuery && recentFoodEntries.length > 0 ? (
                <View style={styles.recentFoods}>
                  <Text style={[styles.recentTitle, { color: colors.mutedForeground }]}>
                    Recent foods
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentFoodScroller}
                  >
                    {recentFoodEntries.map((entry) => (
                      <Pressable
                        key={entry.id}
                        style={[
                          styles.recentFoodChip,
                          { backgroundColor: colors.card, borderColor: colors.border },
                        ]}
                        onPress={() => handleRelogFood(entry)}
                        accessibilityRole="button"
                        accessibilityLabel={`Relog ${entry.name}`}
                      >
                        <Text style={[styles.recentFoodName, { color: colors.text }]}>
                          {entry.name}
                        </Text>
                        <Text style={[styles.recentFoodMeta, { color: colors.mutedForeground }]}>
                          {entry.calories} kcal
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {foodSearchState === "loading" ? (
                <Text style={[styles.searchStatus, { color: colors.mutedForeground }]}>
                  Searching verified food sources...
                </Text>
              ) : null}
              {foodSearchState === "fallback" && foodSearchError ? (
                <Text style={[styles.searchStatus, { color: colors.mutedForeground }]}>
                  Showing offline matches. {foodSearchError}
                </Text>
              ) : null}
              {!debouncedSearchQuery ? (
                <Text style={[styles.searchStatus, { color: colors.mutedForeground }]}>
                  Browse {INDIAN_FOODS.length} foods across {FOOD_CATEGORIES.length} categories
                </Text>
              ) : null}
              <FlatList<FoodEntryDraft>
                data={searchResults}
                keyExtractor={(item) => item.foodId}
                renderItem={({ item }: { item: FoodEntryDraft }) => (
                  <Pressable
                    style={[styles.foodResult, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      selection();
                      setSelectedFood(item);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.name}, ${item.calories} calories`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.foodResultName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.foodResultMeta, { color: colors.mutedForeground }]}>
                        {item.servingSize} · P:{item.protein}g C:{item.carbs}g F:{item.fat}g
                        {item.brand ? ` · ${item.brand}` : ""}
                      </Text>
                      <Text style={[styles.foodResultSource, { color: colors.mutedForeground }]}>
                        {getFoodSourceLabel(item)}
                        {item.confidence ? ` · ${item.confidence}` : ""}
                      </Text>
                    </View>
                    <View
                      style={[styles.searchCalChip, { backgroundColor: colors.primary + "18" }]}
                    >
                      <Text style={[styles.searchCalVal, { color: colors.primary }]}>
                        {item.calories}
                      </Text>
                      <Text style={[styles.searchCalUnit, { color: colors.primary + "90" }]}>
                        kcal
                      </Text>
                    </View>
                  </Pressable>
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webFrame: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 8,
  },
  screenTitle: { fontSize: 28, fontWeight: "800" },
  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cameraBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  scroll: { padding: 16, gap: 12 },
  summaryCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  ringRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  macroSummary: { flex: 1 },
  macroPills: { flexDirection: "row", gap: 10 },
  waterCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  waterHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  waterTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  waterCount: { fontSize: 14, fontWeight: "600" },
  waterGlasses: { flexDirection: "row", gap: 8 },
  waterGlass: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  mealSection: { borderRadius: 16, padding: 12, borderWidth: 1 },
  mealHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mealTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mealIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  mealTitle: {},
  mealCalsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  mealCals: { fontSize: 12, fontWeight: "600" },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  foodEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
  },
  foodName: { fontSize: 14, fontWeight: "500" },
  foodMeta: { fontSize: 12, marginTop: 2 },
  foodSource: { fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  calorieChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignItems: "center" },
  calorieChipText: { fontSize: 14, fontWeight: "700" },
  calorieChipUnit: { fontSize: 9, fontWeight: "600" },
  deleteBtn: { padding: 4 },
  modalContainer: { flex: 1, padding: 20 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 16 },
  recentFoods: { marginBottom: 12, gap: 8 },
  recentTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  recentFoodScroller: { gap: 8 },
  recentFoodChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 130,
  },
  recentFoodName: { fontSize: 13, fontWeight: "700" },
  recentFoodMeta: { fontSize: 11, marginTop: 2 },
  foodResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  foodResultName: { fontSize: 15, fontWeight: "500" },
  foodResultMeta: { fontSize: 12, marginTop: 2 },
  foodResultSource: { fontSize: 11, marginTop: 3, textTransform: "capitalize" },
  searchStatus: { fontSize: 12, marginBottom: 8 },
  searchCalChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 55,
  },
  searchCalVal: { fontSize: 15, fontWeight: "700" },
  searchCalUnit: { fontSize: 9, fontWeight: "600" },
  selectedFoodCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  selectedFoodName: { fontSize: 18, fontWeight: "700" },
  selectedFoodMeta: { fontSize: 13 },
  selectedFoodSource: { fontSize: 12, textTransform: "capitalize" },
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
  servingTotal: { fontSize: 14, fontWeight: "600" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontWeight: "600" },
});
