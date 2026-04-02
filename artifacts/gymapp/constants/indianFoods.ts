export interface FoodItem {
  id: string;
  name: string;
  category: string;
  servingSize: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const INDIAN_FOODS: FoodItem[] = [
  { id: "roti", name: "Roti / Chapati", category: "Breads", servingSize: "1 roti (30g)", servingGrams: 30, calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 2 },
  { id: "phulka", name: "Phulka", category: "Breads", servingSize: "1 phulka (25g)", servingGrams: 25, calories: 68, protein: 2.5, carbs: 13, fat: 0.5, fiber: 1.5 },
  { id: "naan", name: "Naan", category: "Breads", servingSize: "1 naan (90g)", servingGrams: 90, calories: 260, protein: 8, carbs: 45, fat: 5, fiber: 2 },
  { id: "butter_naan", name: "Butter Naan", category: "Breads", servingSize: "1 naan (100g)", servingGrams: 100, calories: 320, protein: 8, carbs: 46, fat: 10, fiber: 2 },
  { id: "paratha", name: "Plain Paratha", category: "Breads", servingSize: "1 paratha (60g)", servingGrams: 60, calories: 180, protein: 4, carbs: 25, fat: 7, fiber: 2 },
  { id: "aloo_paratha", name: "Aloo Paratha", category: "Breads", servingSize: "1 paratha (120g)", servingGrams: 120, calories: 300, protein: 7, carbs: 45, fat: 10, fiber: 3 },
  { id: "puri", name: "Puri", category: "Breads", servingSize: "2 puris (60g)", servingGrams: 60, calories: 200, protein: 4, carbs: 26, fat: 9, fiber: 1.5 },
  { id: "bhakri", name: "Jowar Bhakri", category: "Breads", servingSize: "1 bhakri (50g)", servingGrams: 50, calories: 160, protein: 5, carbs: 30, fat: 2, fiber: 3 },
  { id: "missi_roti", name: "Missi Roti", category: "Breads", servingSize: "1 roti (50g)", servingGrams: 50, calories: 130, protein: 6, carbs: 22, fat: 2.5, fiber: 4 },

  { id: "basmati_rice", name: "Basmati Rice (cooked)", category: "Rice", servingSize: "1 cup (180g)", servingGrams: 180, calories: 240, protein: 5, carbs: 52, fat: 0.5, fiber: 0.5 },
  { id: "brown_rice", name: "Brown Rice (cooked)", category: "Rice", servingSize: "1 cup (195g)", servingGrams: 195, calories: 215, protein: 5, carbs: 45, fat: 1.5, fiber: 3.5 },
  { id: "chicken_biryani", name: "Chicken Biryani", category: "Rice", servingSize: "1 plate (350g)", servingGrams: 350, calories: 550, protein: 28, carbs: 68, fat: 16, fiber: 2 },
  { id: "veg_biryani", name: "Veg Biryani", category: "Rice", servingSize: "1 plate (300g)", servingGrams: 300, calories: 380, protein: 9, carbs: 72, fat: 8, fiber: 4 },
  { id: "mutton_biryani", name: "Mutton Biryani", category: "Rice", servingSize: "1 plate (350g)", servingGrams: 350, calories: 620, protein: 32, carbs: 65, fat: 22, fiber: 2 },
  { id: "jeera_rice", name: "Jeera Rice", category: "Rice", servingSize: "1 plate (200g)", servingGrams: 200, calories: 270, protein: 5, carbs: 55, fat: 4, fiber: 1 },
  { id: "pulao", name: "Veg Pulao", category: "Rice", servingSize: "1 plate (250g)", servingGrams: 250, calories: 350, protein: 8, carbs: 62, fat: 7, fiber: 4 },
  { id: "khichdi", name: "Khichdi", category: "Rice", servingSize: "1 bowl (250g)", servingGrams: 250, calories: 280, protein: 11, carbs: 48, fat: 5, fiber: 5 },

  { id: "dal_tadka", name: "Dal Tadka", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 160, protein: 10, carbs: 24, fat: 4, fiber: 8 },
  { id: "dal_fry", name: "Dal Fry", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 180, protein: 10, carbs: 24, fat: 6, fiber: 7 },
  { id: "dal_makhani", name: "Dal Makhani", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 280, protein: 12, carbs: 28, fat: 14, fiber: 9 },
  { id: "rajma", name: "Rajma Masala", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 230, protein: 13, carbs: 38, fat: 5, fiber: 11 },
  { id: "chole", name: "Chole (Chana Masala)", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 240, protein: 12, carbs: 40, fat: 5, fiber: 10 },
  { id: "sambhar", name: "Sambhar", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 130, protein: 7, carbs: 20, fat: 3, fiber: 6 },
  { id: "moong_dal", name: "Moong Dal", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 140, protein: 9, carbs: 22, fat: 1.5, fiber: 7 },
  { id: "chana_dal", name: "Chana Dal", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 165, protein: 11, carbs: 27, fat: 2, fiber: 8 },
  { id: "masoor_dal", name: "Masoor Dal", category: "Dal & Legumes", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 145, protein: 10, carbs: 24, fat: 1, fiber: 7 },

  { id: "palak_paneer", name: "Palak Paneer", category: "Paneer", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 280, protein: 14, carbs: 12, fat: 20, fiber: 4 },
  { id: "paneer_butter_masala", name: "Paneer Butter Masala", category: "Paneer", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 380, protein: 14, carbs: 18, fat: 28, fiber: 3 },
  { id: "shahi_paneer", name: "Shahi Paneer", category: "Paneer", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 360, protein: 14, carbs: 16, fat: 26, fiber: 2 },
  { id: "matar_paneer", name: "Matar Paneer", category: "Paneer", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 280, protein: 14, carbs: 22, fat: 16, fiber: 5 },
  { id: "kadai_paneer", name: "Kadai Paneer", category: "Paneer", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 320, protein: 14, carbs: 14, fat: 24, fiber: 3 },
  { id: "paneer_tikka", name: "Paneer Tikka", category: "Paneer", servingSize: "4 pieces (150g)", servingGrams: 150, calories: 280, protein: 18, carbs: 8, fat: 20, fiber: 2 },
  { id: "paneer_raw", name: "Paneer (raw)", category: "Paneer", servingSize: "100g", servingGrams: 100, calories: 265, protein: 18, carbs: 2, fat: 20, fiber: 0 },

  { id: "butter_chicken", name: "Butter Chicken", category: "Chicken", servingSize: "1 bowl (250g)", servingGrams: 250, calories: 380, protein: 30, carbs: 14, fat: 22, fiber: 2 },
  { id: "chicken_curry", name: "Chicken Curry", category: "Chicken", servingSize: "1 bowl (250g)", servingGrams: 250, calories: 320, protein: 28, carbs: 8, fat: 18, fiber: 2 },
  { id: "chicken_tikka_masala", name: "Chicken Tikka Masala", category: "Chicken", servingSize: "1 bowl (250g)", servingGrams: 250, calories: 400, protein: 32, carbs: 16, fat: 24, fiber: 2 },
  { id: "chicken_tikka", name: "Chicken Tikka", category: "Chicken", servingSize: "4 pieces (200g)", servingGrams: 200, calories: 280, protein: 38, carbs: 6, fat: 12, fiber: 1 },
  { id: "tandoori_chicken", name: "Tandoori Chicken", category: "Chicken", servingSize: "2 pieces (250g)", servingGrams: 250, calories: 340, protein: 45, carbs: 8, fat: 14, fiber: 1 },
  { id: "chicken_65", name: "Chicken 65", category: "Chicken", servingSize: "6 pieces (150g)", servingGrams: 150, calories: 300, protein: 22, carbs: 18, fat: 14, fiber: 1 },

  { id: "mutton_curry", name: "Mutton Curry", category: "Mutton", servingSize: "1 bowl (250g)", servingGrams: 250, calories: 420, protein: 35, carbs: 8, fat: 28, fiber: 2 },
  { id: "mutton_rogan_josh", name: "Mutton Rogan Josh", category: "Mutton", servingSize: "1 bowl (250g)", servingGrams: 250, calories: 400, protein: 32, carbs: 10, fat: 26, fiber: 2 },
  { id: "keema", name: "Keema (Minced Mutton)", category: "Mutton", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 380, protein: 28, carbs: 12, fat: 26, fiber: 3 },

  { id: "egg_curry", name: "Egg Curry", category: "Eggs", servingSize: "2 eggs with gravy (200g)", servingGrams: 200, calories: 260, protein: 16, carbs: 10, fat: 18, fiber: 2 },
  { id: "egg_bhurji", name: "Egg Bhurji", category: "Eggs", servingSize: "2 eggs (150g)", servingGrams: 150, calories: 220, protein: 14, carbs: 4, fat: 16, fiber: 1 },
  { id: "boiled_egg", name: "Boiled Egg", category: "Eggs", servingSize: "1 egg (50g)", servingGrams: 50, calories: 78, protein: 6, carbs: 0.6, fat: 5, fiber: 0 },
  { id: "omelette", name: "Omelette (2 egg)", category: "Eggs", servingSize: "1 omelette (120g)", servingGrams: 120, calories: 200, protein: 14, carbs: 2, fat: 15, fiber: 0 },

  { id: "fish_curry", name: "Fish Curry", category: "Fish & Seafood", servingSize: "1 bowl (250g)", servingGrams: 250, calories: 250, protein: 28, carbs: 8, fat: 12, fiber: 2 },
  { id: "prawn_masala", name: "Prawn Masala", category: "Fish & Seafood", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 220, protein: 24, carbs: 10, fat: 10, fiber: 2 },

  { id: "idli", name: "Idli", category: "South Indian", servingSize: "2 idlis (100g)", servingGrams: 100, calories: 130, protein: 4, carbs: 26, fat: 0.5, fiber: 1 },
  { id: "dosa", name: "Masala Dosa", category: "South Indian", servingSize: "1 dosa (150g)", servingGrams: 150, calories: 220, protein: 5, carbs: 36, fat: 7, fiber: 2 },
  { id: "plain_dosa", name: "Plain Dosa", category: "South Indian", servingSize: "1 dosa (100g)", servingGrams: 100, calories: 120, protein: 3, carbs: 22, fat: 2, fiber: 1 },
  { id: "uttapam", name: "Uttapam", category: "South Indian", servingSize: "1 piece (120g)", servingGrams: 120, calories: 170, protein: 4, carbs: 30, fat: 4, fiber: 2 },
  { id: "medu_vada", name: "Medu Vada", category: "South Indian", servingSize: "2 vadas (100g)", servingGrams: 100, calories: 220, protein: 7, carbs: 26, fat: 10, fiber: 4 },
  { id: "rasam", name: "Rasam", category: "South Indian", servingSize: "1 cup (200ml)", servingGrams: 200, calories: 40, protein: 2, carbs: 7, fat: 1, fiber: 1 },
  { id: "coconut_chutney", name: "Coconut Chutney", category: "South Indian", servingSize: "2 tbsp (30g)", servingGrams: 30, calories: 45, protein: 0.5, carbs: 2, fat: 4, fiber: 1 },

  { id: "poha", name: "Poha", category: "Breakfast", servingSize: "1 plate (200g)", servingGrams: 200, calories: 280, protein: 5, carbs: 52, fat: 6, fiber: 2 },
  { id: "upma", name: "Upma", category: "Breakfast", servingSize: "1 plate (200g)", servingGrams: 200, calories: 240, protein: 6, carbs: 42, fat: 6, fiber: 3 },
  { id: "sabudana_khichdi", name: "Sabudana Khichdi", category: "Breakfast", servingSize: "1 plate (200g)", servingGrams: 200, calories: 340, protein: 5, carbs: 65, fat: 7, fiber: 1 },
  { id: "besan_chilla", name: "Besan Chilla", category: "Breakfast", servingSize: "2 chillas (150g)", servingGrams: 150, calories: 200, protein: 10, carbs: 28, fat: 5, fiber: 5 },

  { id: "aloo_gobi", name: "Aloo Gobi", category: "Vegetables", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 180, protein: 5, carbs: 30, fat: 6, fiber: 5 },
  { id: "baingan_bharta", name: "Baingan Bharta", category: "Vegetables", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 120, protein: 3, carbs: 16, fat: 5, fiber: 6 },
  { id: "bhindi_masala", name: "Bhindi Masala", category: "Vegetables", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 130, protein: 4, carbs: 18, fat: 5, fiber: 7 },
  { id: "kadhi", name: "Kadhi Pakora", category: "Vegetables", servingSize: "1 bowl (250g)", servingGrams: 250, calories: 200, protein: 8, carbs: 22, fat: 9, fiber: 3 },
  { id: "matar_mushroom", name: "Matar Mushroom", category: "Vegetables", servingSize: "1 bowl (200g)", servingGrams: 200, calories: 160, protein: 7, carbs: 20, fat: 6, fiber: 5 },

  { id: "samosa", name: "Samosa", category: "Snacks", servingSize: "1 samosa (80g)", servingGrams: 80, calories: 200, protein: 3, carbs: 24, fat: 10, fiber: 2 },
  { id: "kachori", name: "Kachori", category: "Snacks", servingSize: "1 kachori (70g)", servingGrams: 70, calories: 220, protein: 4, carbs: 26, fat: 11, fiber: 2 },
  { id: "pakora", name: "Pakora (vegetable)", category: "Snacks", servingSize: "4 pieces (100g)", servingGrams: 100, calories: 240, protein: 5, carbs: 28, fat: 12, fiber: 3 },
  { id: "dhokla", name: "Dhokla", category: "Snacks", servingSize: "4 pieces (120g)", servingGrams: 120, calories: 160, protein: 7, carbs: 28, fat: 3, fiber: 3 },
  { id: "bhel_puri", name: "Bhel Puri", category: "Snacks", servingSize: "1 plate (150g)", servingGrams: 150, calories: 220, protein: 5, carbs: 40, fat: 5, fiber: 3 },
  { id: "pani_puri", name: "Pani Puri (6 pieces)", category: "Snacks", servingSize: "6 pieces (120g)", servingGrams: 120, calories: 180, protein: 3, carbs: 34, fat: 4, fiber: 2 },
  { id: "vada_pav", name: "Vada Pav", category: "Snacks", servingSize: "1 piece (150g)", servingGrams: 150, calories: 350, protein: 7, carbs: 52, fat: 13, fiber: 3 },
  { id: "pav_bhaji", name: "Pav Bhaji (2 pav + bhaji)", category: "Snacks", servingSize: "1 plate (300g)", servingGrams: 300, calories: 520, protein: 12, carbs: 80, fat: 16, fiber: 8 },
  { id: "aloo_tikki", name: "Aloo Tikki", category: "Snacks", servingSize: "2 tikkis (120g)", servingGrams: 120, calories: 250, protein: 4, carbs: 38, fat: 9, fiber: 3 },
  { id: "chaat", name: "Dahi Papdi Chaat", category: "Snacks", servingSize: "1 plate (200g)", servingGrams: 200, calories: 280, protein: 8, carbs: 44, fat: 8, fiber: 3 },

  { id: "gulab_jamun", name: "Gulab Jamun", category: "Sweets", servingSize: "2 pieces (80g)", servingGrams: 80, calories: 280, protein: 4, carbs: 48, fat: 8, fiber: 0.5 },
  { id: "kheer", name: "Kheer (Rice Pudding)", category: "Sweets", servingSize: "1 bowl (150g)", servingGrams: 150, calories: 220, protein: 5, carbs: 38, fat: 6, fiber: 0.5 },
  { id: "halwa", name: "Sooji Halwa", category: "Sweets", servingSize: "1 serving (100g)", servingGrams: 100, calories: 280, protein: 4, carbs: 40, fat: 11, fiber: 1 },
  { id: "ladoo", name: "Besan Ladoo", category: "Sweets", servingSize: "1 ladoo (40g)", servingGrams: 40, calories: 180, protein: 4, carbs: 22, fat: 9, fiber: 1.5 },
  { id: "jalebi", name: "Jalebi", category: "Sweets", servingSize: "3 pieces (75g)", servingGrams: 75, calories: 280, protein: 2, carbs: 58, fat: 5, fiber: 0 },
  { id: "barfi", name: "Milk Barfi", category: "Sweets", servingSize: "1 piece (40g)", servingGrams: 40, calories: 160, protein: 4, carbs: 22, fat: 6, fiber: 0 },
  { id: "rasgulla", name: "Rasgulla", category: "Sweets", servingSize: "2 pieces (80g)", servingGrams: 80, calories: 150, protein: 4, carbs: 28, fat: 1.5, fiber: 0 },
  { id: "gajar_halwa", name: "Gajar Halwa", category: "Sweets", servingSize: "1 serving (100g)", servingGrams: 100, calories: 220, protein: 4, carbs: 30, fat: 10, fiber: 2 },

  { id: "curd", name: "Plain Curd / Dahi", category: "Dairy", servingSize: "1 cup (200g)", servingGrams: 200, calories: 120, protein: 8, carbs: 10, fat: 5, fiber: 0 },
  { id: "lassi_sweet", name: "Sweet Lassi", category: "Dairy", servingSize: "1 glass (300ml)", servingGrams: 300, calories: 220, protein: 8, carbs: 36, fat: 5, fiber: 0 },
  { id: "lassi_plain", name: "Plain Lassi", category: "Dairy", servingSize: "1 glass (300ml)", servingGrams: 300, calories: 160, protein: 9, carbs: 18, fat: 5, fiber: 0 },
  { id: "chaas", name: "Chaas / Buttermilk", category: "Dairy", servingSize: "1 glass (300ml)", servingGrams: 300, calories: 70, protein: 4, carbs: 7, fat: 2, fiber: 0 },
  { id: "milk_cow", name: "Full Cream Milk", category: "Dairy", servingSize: "1 glass (250ml)", servingGrams: 250, calories: 155, protein: 8, carbs: 12, fat: 8, fiber: 0 },
  { id: "milk_toned", name: "Toned Milk", category: "Dairy", servingSize: "1 glass (250ml)", servingGrams: 250, calories: 120, protein: 8, carbs: 12, fat: 3, fiber: 0 },
  { id: "paneer_100", name: "Cottage Cheese / Paneer", category: "Dairy", servingSize: "100g", servingGrams: 100, calories: 265, protein: 18, carbs: 2.5, fat: 20, fiber: 0 },
  { id: "ghee", name: "Desi Ghee", category: "Dairy", servingSize: "1 tsp (5g)", servingGrams: 5, calories: 45, protein: 0, carbs: 0, fat: 5, fiber: 0 },

  { id: "protein_shake", name: "Whey Protein Shake", category: "Fitness", servingSize: "1 scoop (30g)", servingGrams: 30, calories: 120, protein: 24, carbs: 3, fat: 2, fiber: 0 },
  { id: "banana", name: "Banana", category: "Fruits", servingSize: "1 medium (100g)", servingGrams: 100, calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
  { id: "apple", name: "Apple", category: "Fruits", servingSize: "1 medium (150g)", servingGrams: 150, calories: 78, protein: 0.4, carbs: 21, fat: 0.2, fiber: 3 },
  { id: "mango", name: "Mango", category: "Fruits", servingSize: "1 cup (150g)", servingGrams: 150, calories: 99, protein: 1.4, carbs: 25, fat: 0.6, fiber: 2.6 },
  { id: "papaya", name: "Papaya", category: "Fruits", servingSize: "1 cup (145g)", servingGrams: 145, calories: 62, protein: 0.7, carbs: 16, fat: 0.4, fiber: 2.5 },

  { id: "green_tea", name: "Green Tea", category: "Beverages", servingSize: "1 cup (200ml)", servingGrams: 200, calories: 2, protein: 0, carbs: 0.5, fat: 0, fiber: 0 },
  { id: "masala_chai", name: "Masala Chai (with milk & sugar)", category: "Beverages", servingSize: "1 cup (200ml)", servingGrams: 200, calories: 80, protein: 2.5, carbs: 12, fat: 2.5, fiber: 0 },
  { id: "black_coffee", name: "Black Coffee", category: "Beverages", servingSize: "1 cup (200ml)", servingGrams: 200, calories: 5, protein: 0.3, carbs: 1, fat: 0, fiber: 0 },
  { id: "coconut_water", name: "Coconut Water", category: "Beverages", servingSize: "1 glass (240ml)", servingGrams: 240, calories: 46, protein: 1.7, carbs: 9, fat: 0.5, fiber: 0 },
];

export const FOOD_CATEGORIES = [...new Set(INDIAN_FOODS.map((f) => f.category))];

export function searchFoods(query: string): FoodItem[] {
  const q = query.toLowerCase();
  return INDIAN_FOODS.filter(
    (f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q),
  );
}
