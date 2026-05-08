import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  db,
  monthlyReviews,
  userProfiles,
  type MonthlyReview,
  type MonthlyReviewBadge,
  type MonthlyReviewMetrics,
  type MonthlyReviewStatus,
  type MonthlyReviewSuggestedAdjustment,
} from "@workspace/db";
import { requireApiAuth } from "../middlewares/apiAuth.ts";
import { requireApprovedAccess } from "../lib/user-access.ts";

const router = Router();
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_AI_INPUT_CHARS = 12_000;
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

type ApprovedAccess = NonNullable<Awaited<ReturnType<typeof requireApprovedAccess>>>;

interface AiReviewFields {
  aiSummary: string;
  coachNote: string;
  suggestedAdjustments: MonthlyReviewSuggestedAdjustment[];
}

router.use(requireApiAuth);

function getSingleValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function isTrainerOrOwner(role: unknown) {
  return role === "trainer" || role === "owner";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeMetrics(value: unknown): MonthlyReviewMetrics | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const metrics: MonthlyReviewMetrics = { ...value };
  for (const key of [
    "daysInMonth",
    "elapsedDays",
    "completedWorkouts",
    "workoutDays",
    "consistencyRate",
    "totalVolume",
    "totalDurationMinutes",
    "caloriesBurned",
    "prCount",
    "nutritionLoggedDays",
    "nutritionAdherenceRate",
    "avgCalories",
    "avgProtein",
    "proteinAdherenceRate",
    "waterLoggedDays",
    "bodyWeightStart",
    "bodyWeightEnd",
    "weightDelta",
    "bodyMeasurementsLogged",
    "savedPlanCount",
    "plansSavedThisMonth",
  ] as const) {
    const numberValue = normalizeNumber(metrics[key]);
    if (numberValue !== undefined) {
      metrics[key] = numberValue;
    }
  }

  metrics.risks = Array.isArray(value.risks)
    ? value.risks.filter((risk): risk is string => typeof risk === "string").slice(0, 8)
    : [];

  return metrics;
}

function normalizeBadges(value: unknown): MonthlyReviewBadge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((badge, index) => {
      if (!isObjectRecord(badge)) return null;
      const label = normalizeText(badge.label);
      const detail = normalizeText(badge.detail);
      if (!label || !detail) return null;

      const tone =
        badge.tone === "success" ||
        badge.tone === "warning" ||
        badge.tone === "info" ||
        badge.tone === "neutral"
          ? badge.tone
          : "neutral";

      return {
        id: normalizeText(badge.id, `badge_${index + 1}`),
        label,
        detail,
        tone,
      };
    })
    .filter((badge): badge is MonthlyReviewBadge => Boolean(badge))
    .slice(0, 10);
}

function normalizeSuggestions(
  value: unknown,
  source: MonthlyReviewSuggestedAdjustment["source"],
): MonthlyReviewSuggestedAdjustment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((suggestion, index) => {
      if (!isObjectRecord(suggestion)) return null;
      const title = normalizeText(suggestion.title);
      const detail = normalizeText(suggestion.detail);
      if (!title || !detail) return null;

      const category =
        suggestion.category === "workout" ||
        suggestion.category === "nutrition" ||
        suggestion.category === "recovery" ||
        suggestion.category === "trainer" ||
        suggestion.category === "habit"
          ? suggestion.category
          : "habit";
      const priority =
        suggestion.priority === "high" ||
        suggestion.priority === "medium" ||
        suggestion.priority === "low"
          ? suggestion.priority
          : "medium";

      return {
        id: normalizeText(suggestion.id, `${source}_suggestion_${index + 1}`),
        category,
        title,
        detail,
        priority,
        source,
      };
    })
    .filter((suggestion): suggestion is MonthlyReviewSuggestedAdjustment => Boolean(suggestion))
    .slice(0, 6);
}

function fallbackSummary(metrics: MonthlyReviewMetrics) {
  const workouts = Math.round(normalizeNumber(metrics.completedWorkouts) ?? 0);
  const consistency = Math.round(normalizeNumber(metrics.consistencyRate) ?? 0);
  const prs = Math.round(normalizeNumber(metrics.prCount) ?? 0);

  if (workouts === 0) {
    return "Starting point saved. This month does not have completed workout data yet, so the next win is one repeatable training day and basic nutrition logging.";
  }

  if (workouts >= 10 || consistency >= 45) {
    return `Strong month saved: ${workouts} completed workouts, ${consistency}% training-day consistency, and ${prs} PR${prs === 1 ? "" : "s"}.`;
  }

  return `Month saved with ${workouts} completed workout${workouts === 1 ? "" : "s"} and ${consistency}% consistency. The highest leverage move is making next month easier to repeat.`;
}

function fallbackCoachNote(metrics: MonthlyReviewMetrics) {
  const risks = Array.isArray(metrics.risks) ? metrics.risks : [];
  if (risks.length > 0) {
    return `Coach note: watch ${risks.slice(0, 2).join(" and ")} before adding more intensity. AI suggestions are advisory only and should be applied by the member or trainer.`;
  }

  return "Coach note: keep the plan practical. Repeat the sessions that were easiest to complete, protect recovery, and only adjust training or nutrition targets after a deliberate review.";
}

function fallbackSuggestions(metrics: MonthlyReviewMetrics): MonthlyReviewSuggestedAdjustment[] {
  const suggestions: MonthlyReviewSuggestedAdjustment[] = [];
  const workouts = normalizeNumber(metrics.completedWorkouts) ?? 0;
  const consistency = normalizeNumber(metrics.consistencyRate) ?? 0;
  const nutritionLoggedDays = normalizeNumber(metrics.nutritionLoggedDays) ?? 0;
  const proteinAdherence = normalizeNumber(metrics.proteinAdherenceRate) ?? 0;
  const risks = Array.isArray(metrics.risks) ? metrics.risks : [];

  if (workouts <= 1 || consistency < 25) {
    suggestions.push({
      id: "repeat_two_training_days",
      category: "workout",
      title: "Anchor two fixed training days",
      detail:
        "Schedule two repeatable full-body or Push/Pull sessions next week before adding extra volume.",
      priority: "high",
      source: "deterministic",
    });
  } else if (workouts >= 10 && risks.length === 0) {
    suggestions.push({
      id: "protect_momentum",
      category: "workout",
      title: "Keep volume steady",
      detail:
        "Repeat the same weekly structure next week and only add 1-2 working sets to the strongest lift.",
      priority: "medium",
      source: "deterministic",
    });
  }

  if (nutritionLoggedDays < 8) {
    suggestions.push({
      id: "increase_nutrition_logging",
      category: "nutrition",
      title: "Log protein first",
      detail: "Track protein at breakfast and dinner for 10 days before changing calorie targets.",
      priority: "medium",
      source: "deterministic",
    });
  } else if (proteinAdherence < 60) {
    suggestions.push({
      id: "increase_protein_consistency",
      category: "nutrition",
      title: "Increase protein consistency",
      detail:
        "Add one planned high-protein meal or shake on training days and review adherence after one week.",
      priority: "medium",
      source: "deterministic",
    });
  }

  if (risks.some((risk) => risk.toLowerCase().includes("back"))) {
    suggestions.push({
      id: "trainer_check_lower_back",
      category: "trainer",
      title: "Check lower-back limitation",
      detail:
        "Trainer should review hinge, squat, and loaded carry choices before progressing lower-body load.",
      priority: "high",
      source: "deterministic",
    });
  }

  return suggestions.slice(0, 4);
}

function mergeSuggestions(
  deterministic: MonthlyReviewSuggestedAdjustment[],
  aiSuggestions: MonthlyReviewSuggestedAdjustment[],
) {
  const seen = new Set<string>();
  return [...aiSuggestions, ...deterministic]
    .filter((suggestion) => {
      const key = `${suggestion.category}:${suggestion.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function parseAiJson(text: string) {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned) as unknown;
}

async function buildAiReviewFields(args: {
  month: string;
  metrics: MonthlyReviewMetrics;
  badges: MonthlyReviewBadge[];
  deterministicSuggestions: MonthlyReviewSuggestedAdjustment[];
}): Promise<AiReviewFields> {
  const fallback: AiReviewFields = {
    aiSummary: fallbackSummary(args.metrics),
    coachNote: fallbackCoachNote(args.metrics),
    suggestedAdjustments: fallbackSuggestions(args.metrics),
  };
  const baseSuggestions = args.deterministicSuggestions.length
    ? args.deterministicSuggestions
    : fallback.suggestedAdjustments;

  try {
    const prompt = `You are writing a premium monthly fitness review for a gym member.

Rules:
- Advisory only. Do not auto-apply workout plans, assignments, nutrition targets, or goals.
- Be concrete and coaching-oriented, not generic.
- Use only these bounded monthly aggregates, not imagined raw meal or workout logs.
- Suggested changes must be small enough for a trainer or member to approve manually.
- Return JSON only with this shape:
{
  "aiSummary": "1 sentence headline",
  "coachNote": "2-3 sentence coach note",
  "suggestedAdjustments": [
    {"category":"workout|nutrition|recovery|trainer|habit","title":"short title","detail":"specific action","priority":"low|medium|high"}
  ]
}

Monthly review input:
${JSON.stringify({
  month: args.month,
  metrics: args.metrics,
  badges: args.badges,
  deterministicSuggestions: baseSuggestions,
}).slice(0, MAX_AI_INPUT_CHARS)}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseAiJson(response.text ?? "");
    if (!isObjectRecord(parsed)) {
      return { ...fallback, suggestedAdjustments: baseSuggestions };
    }

    const aiSuggestions = normalizeSuggestions(parsed.suggestedAdjustments, "ai");
    return {
      aiSummary: normalizeText(parsed.aiSummary, fallback.aiSummary),
      coachNote: normalizeText(parsed.coachNote, fallback.coachNote),
      suggestedAdjustments: mergeSuggestions(baseSuggestions, aiSuggestions),
    };
  } catch {
    return { ...fallback, suggestedAdjustments: baseSuggestions };
  }
}

function serializeReview(review: MonthlyReview) {
  return {
    ...review,
    generatedAt: review.generatedAt.toISOString(),
    reviewedAt: review.reviewedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

async function resolveMemberId(
  req: Request,
  res: Response,
  access: ApprovedAccess,
  rawMemberId: unknown,
): Promise<string | null> {
  const requestedMemberId = getSingleValue(rawMemberId)?.trim();

  if (!isTrainerOrOwner(access.role)) {
    if (requestedMemberId && requestedMemberId !== access.userId) {
      res.status(403).json({ error: "You can only access your own monthly reviews" });
      return null;
    }
    return access.userId;
  }

  if (!requestedMemberId) {
    res.status(400).json({ error: "memberId is required for trainer review access" });
    return null;
  }

  const [memberProfile] = await db
    .select({ clerkId: userProfiles.clerkId })
    .from(userProfiles)
    .where(
      and(
        eq(userProfiles.clerkId, requestedMemberId),
        eq(userProfiles.gymId, access.gymId),
        eq(userProfiles.role, "member"),
      ),
    )
    .limit(1);

  if (!memberProfile) {
    res.status(404).json({ error: "Member not found" });
    return null;
  }

  return memberProfile.clerkId;
}

async function findReview(args: { gymId: string; memberClerkId: string; month: string }) {
  const [review] = await db
    .select()
    .from(monthlyReviews)
    .where(
      and(
        eq(monthlyReviews.gymId, args.gymId),
        eq(monthlyReviews.memberClerkId, args.memberClerkId),
        eq(monthlyReviews.month, args.month),
      ),
    )
    .limit(1);

  return review ?? null;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;

    const month = getSingleValue(req.query.month)?.trim();
    if (!month || !MONTH_RE.test(month)) {
      res.status(400).json({ error: "month must use YYYY-MM format" });
      return;
    }

    const memberClerkId = await resolveMemberId(req, res, access, req.query.memberId);
    if (!memberClerkId) return;

    const review = await findReview({ gymId: access.gymId, memberClerkId, month });
    res.json({ review: review ? serializeReview(review) : null });
  } catch (err) {
    req.log.error({ err }, "Error fetching monthly review");
    res.status(500).json({ error: "Failed to fetch monthly review" });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const month = normalizeText(body.month);
    if (!MONTH_RE.test(month)) {
      res.status(400).json({ error: "month must use YYYY-MM format" });
      return;
    }

    const metrics = normalizeMetrics(body.metrics);
    if (!metrics) {
      res.status(400).json({ error: "metrics must be a monthly aggregate object" });
      return;
    }

    const memberClerkId = await resolveMemberId(req, res, access, body.memberId);
    if (!memberClerkId) return;

    const badges = normalizeBadges(body.badges);
    const deterministicSuggestions = normalizeSuggestions(
      body.suggestedAdjustments,
      "deterministic",
    );
    const aiFields = await buildAiReviewFields({
      month,
      metrics,
      badges,
      deterministicSuggestions,
    });
    const now = new Date();
    const existingReview = await findReview({ gymId: access.gymId, memberClerkId, month });

    if (existingReview) {
      const [updatedReview] = await db
        .update(monthlyReviews)
        .set({
          metrics,
          badges,
          aiSummary: aiFields.aiSummary,
          coachNote: aiFields.coachNote,
          suggestedAdjustments: aiFields.suggestedAdjustments,
          status: "generated",
          generatedAt: now,
          reviewedAt: null,
          updatedAt: now,
        })
        .where(
          and(eq(monthlyReviews.id, existingReview.id), eq(monthlyReviews.gymId, access.gymId)),
        )
        .returning();

      res.json({ review: serializeReview(updatedReview) });
      return;
    }

    const [createdReview] = await db
      .insert(monthlyReviews)
      .values({
        id: randomUUID(),
        gymId: access.gymId,
        memberClerkId,
        month,
        metrics,
        badges,
        aiSummary: aiFields.aiSummary,
        coachNote: aiFields.coachNote,
        suggestedAdjustments: aiFields.suggestedAdjustments,
        status: "generated",
        generatedAt: now,
      })
      .returning();

    res.status(201).json({ review: serializeReview(createdReview) });
  } catch (err) {
    req.log.error({ err }, "Error generating monthly review");
    res.status(500).json({ error: "Failed to generate monthly review" });
  }
});

router.patch("/:id/review", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;

    const reviewId = getSingleValue(req.params.id)?.trim();
    if (!reviewId) {
      res.status(400).json({ error: "Invalid monthly review id" });
      return;
    }

    const [review] = await db
      .select()
      .from(monthlyReviews)
      .where(and(eq(monthlyReviews.id, reviewId), eq(monthlyReviews.gymId, access.gymId)))
      .limit(1);

    if (!review) {
      res.status(404).json({ error: "Monthly review not found" });
      return;
    }

    if (!isTrainerOrOwner(access.role) && review.memberClerkId !== access.userId) {
      res.status(403).json({ error: "You can only review your own monthly reviews" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const shouldMarkReviewed =
      body.reviewed === true || body.status === "reviewed" || body.reviewedAt === true;
    const nextStatus: MonthlyReviewStatus = shouldMarkReviewed ? "reviewed" : "generated";
    const reviewedAt = shouldMarkReviewed ? new Date() : null;

    const [updatedReview] = await db
      .update(monthlyReviews)
      .set({
        status: nextStatus,
        reviewedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(monthlyReviews.id, review.id), eq(monthlyReviews.gymId, access.gymId)))
      .returning();

    res.json({ review: serializeReview(updatedReview) });
  } catch (err) {
    req.log.error({ err }, "Error updating monthly review state");
    res.status(500).json({ error: "Failed to update monthly review state" });
  }
});

export default router;
