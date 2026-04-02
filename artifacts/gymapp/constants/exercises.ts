export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscleGroup: string;
  equipment: string;
  description: string;
  defaultSets: number;
  defaultReps: string;
  defaultRestSeconds: number;
}

export const EXERCISES: Exercise[] = [
  { id: "bench_press", name: "Bench Press", category: "Strength", muscleGroup: "Chest", equipment: "Barbell", description: "Lie on bench, lower bar to chest, press up", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "incline_press", name: "Incline Bench Press", category: "Strength", muscleGroup: "Chest", equipment: "Barbell", description: "Incline bench at 30-45°, press barbell", defaultSets: 3, defaultReps: "8-12", defaultRestSeconds: 90 },
  { id: "dumbbell_fly", name: "Dumbbell Fly", category: "Strength", muscleGroup: "Chest", equipment: "Dumbbell", description: "Lie on bench, arc dumbbells from sides to top", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "pushup", name: "Push Up", category: "Bodyweight", muscleGroup: "Chest", equipment: "None", description: "Classic push up with full range of motion", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 60 },
  { id: "cable_crossover", name: "Cable Crossover", category: "Strength", muscleGroup: "Chest", equipment: "Cable", description: "Pull cables from high to low across body", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },

  { id: "squat", name: "Back Squat", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Bar on traps, squat to parallel depth", defaultSets: 4, defaultReps: "6-8", defaultRestSeconds: 120 },
  { id: "leg_press", name: "Leg Press", category: "Strength", muscleGroup: "Legs", equipment: "Machine", description: "Press platform away, feet shoulder-width", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 90 },
  { id: "lunges", name: "Lunges", category: "Strength", muscleGroup: "Legs", equipment: "Dumbbell", description: "Step forward, lower back knee to floor", defaultSets: 3, defaultReps: "12 each", defaultRestSeconds: 60 },
  { id: "leg_curl", name: "Hamstring Curl", category: "Strength", muscleGroup: "Legs", equipment: "Machine", description: "Curl legs up on lying curl machine", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "calf_raise", name: "Calf Raise", category: "Strength", muscleGroup: "Legs", equipment: "Machine", description: "Raise on toes, full range of motion", defaultSets: 4, defaultReps: "15-20", defaultRestSeconds: 45 },
  { id: "deadlift", name: "Deadlift", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Hinge at hips, keep back straight, lift bar", defaultSets: 4, defaultReps: "5-6", defaultRestSeconds: 120 },
  { id: "rdl", name: "Romanian Deadlift", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Hinge at hips with slight knee bend", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "goblet_squat", name: "Goblet Squat", category: "Strength", muscleGroup: "Legs", equipment: "Dumbbell", description: "Hold dumbbell at chest, squat deep", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },

  { id: "pullup", name: "Pull Up", category: "Bodyweight", muscleGroup: "Back", equipment: "None", description: "Dead hang, pull until chin clears bar", defaultSets: 3, defaultReps: "6-10", defaultRestSeconds: 90 },
  { id: "lat_pulldown", name: "Lat Pulldown", category: "Strength", muscleGroup: "Back", equipment: "Cable", description: "Pull bar to upper chest, squeeze lats", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },
  { id: "bent_row", name: "Bent Over Row", category: "Strength", muscleGroup: "Back", equipment: "Barbell", description: "Hinge forward, pull bar to lower chest", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "seated_row", name: "Seated Cable Row", category: "Strength", muscleGroup: "Back", equipment: "Cable", description: "Pull handle to abdomen, squeeze shoulder blades", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },
  { id: "face_pull", name: "Face Pull", category: "Strength", muscleGroup: "Back", equipment: "Cable", description: "Pull rope to face level, elbows high", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 60 },

  { id: "overhead_press", name: "Overhead Press", category: "Strength", muscleGroup: "Shoulders", equipment: "Barbell", description: "Press barbell overhead from front rack", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "lateral_raise", name: "Lateral Raise", category: "Strength", muscleGroup: "Shoulders", equipment: "Dumbbell", description: "Raise dumbbells to sides to shoulder height", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "front_raise", name: "Front Raise", category: "Strength", muscleGroup: "Shoulders", equipment: "Dumbbell", description: "Raise dumbbells to shoulder height in front", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "shoulder_press", name: "Dumbbell Shoulder Press", category: "Strength", muscleGroup: "Shoulders", equipment: "Dumbbell", description: "Press dumbbells overhead from ear height", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },

  { id: "bicep_curl", name: "Bicep Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Dumbbell", description: "Curl dumbbells alternately, supinate at top", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "hammer_curl", name: "Hammer Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Dumbbell", description: "Neutral grip curl for biceps and brachialis", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "tricep_pushdown", name: "Tricep Pushdown", category: "Strength", muscleGroup: "Triceps", equipment: "Cable", description: "Push rope/bar down, lock out elbows", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "skull_crusher", name: "Skull Crusher", category: "Strength", muscleGroup: "Triceps", equipment: "Barbell", description: "Lower bar to forehead, extend arms", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "dips", name: "Tricep Dips", category: "Bodyweight", muscleGroup: "Triceps", equipment: "None", description: "Dip between parallel bars, upright torso", defaultSets: 3, defaultReps: "10-15", defaultRestSeconds: 75 },

  { id: "plank", name: "Plank", category: "Core", muscleGroup: "Core", equipment: "None", description: "Hold forearm plank position", defaultSets: 3, defaultReps: "30-60 sec", defaultRestSeconds: 45 },
  { id: "crunches", name: "Crunches", category: "Core", muscleGroup: "Core", equipment: "None", description: "Lie down, crunch upper body toward knees", defaultSets: 3, defaultReps: "20-25", defaultRestSeconds: 45 },
  { id: "leg_raises", name: "Leg Raises", category: "Core", muscleGroup: "Core", equipment: "None", description: "Lie flat, raise legs to 90 degrees", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 45 },
  { id: "russian_twist", name: "Russian Twist", category: "Core", muscleGroup: "Core", equipment: "None", description: "Seated, rotate torso side to side", defaultSets: 3, defaultReps: "20 each side", defaultRestSeconds: 45 },
  { id: "mountain_climber", name: "Mountain Climbers", category: "Cardio", muscleGroup: "Core", equipment: "None", description: "Plank position, drive knees to chest alternately", defaultSets: 3, defaultReps: "30 sec", defaultRestSeconds: 30 },

  { id: "burpee", name: "Burpees", category: "Cardio", muscleGroup: "Full Body", equipment: "None", description: "Jump, drop to plank, push up, jump up", defaultSets: 3, defaultReps: "10-15", defaultRestSeconds: 60 },
  { id: "jumping_jacks", name: "Jumping Jacks", category: "Cardio", muscleGroup: "Full Body", equipment: "None", description: "Jump with arms and legs out simultaneously", defaultSets: 3, defaultReps: "30-50", defaultRestSeconds: 30 },
  { id: "jump_rope", name: "Jump Rope", category: "Cardio", muscleGroup: "Full Body", equipment: "Jump Rope", description: "Skip rope at consistent pace", defaultSets: 3, defaultReps: "1 min", defaultRestSeconds: 30 },
  { id: "box_jump", name: "Box Jumps", category: "Cardio", muscleGroup: "Legs", equipment: "Box", description: "Jump onto box, step down carefully", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 60 },
];

export const EXERCISE_CATEGORIES = [...new Set(EXERCISES.map((e) => e.category))];
export const MUSCLE_GROUPS = [...new Set(EXERCISES.map((e) => e.muscleGroup))];

export function searchExercises(query: string, category?: string): Exercise[] {
  let results = EXERCISES;
  if (category && category !== "All") {
    results = results.filter((e) => e.category === category || e.muscleGroup === category);
  }
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q),
    );
  }
  return results;
}
