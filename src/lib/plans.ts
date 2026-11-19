export type PlanId = "STANDARD" | "PRO_MAX";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  thaiName: string;
  badge: string;
  priceThb: number;
  priceLabel: string;
  billingCycle: string;
  credits: number;
  maxBots: number;
  rateLimitPerMinute: number;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  STANDARD: {
    id: "STANDARD",
    name: "Standard",
    thaiName: "Standard Plan",
    badge: "เริ่มต้น",
    priceThb: 0,
    priceLabel: "฿0",
    billingCycle: "ใช้งานฟรี ไม่มีค่าบริการรายเดือน",
    credits: 100,
    maxBots: 5,
    rateLimitPerMinute: 60,
    description: "เหมาะสำหรับเว็บไซต์ท่องเที่ยวขนาดเล็กและเริ่มต้นใช้งานแชทบอท AI",
    features: [
      "100 API Credits สำหรับตอบแชทลูกค้า",
      "สร้างแชทบอทได้สูงสุด 5 บอท",
      "ฐานความรู้ RAG (อัปโหลดเอกสารและดูดข้อมูลเว็บไซต์)",
      "รองรับโมเดล Gemini 3.5 Flash Lite",
      "ปรับแต่งสีและข้อความต้อนรับของ Widget ได้",
      "Rate limit 60 คำขอ/นาที",
    ],
  },
  PRO_MAX: {
    id: "PRO_MAX",
    name: "Pro Max",
    thaiName: "Pro Max Plan",
    badge: "แนะนำ • ยอดนิยม",
    priceThb: 590,
    priceLabel: "฿590",
    billingCycle: "ต่อเดือน • เครดิตสูงและรองรับบอทจำนวนมาก",
    credits: 2000,
    maxBots: 25,
    rateLimitPerMinute: 300,
    description: "สำหรับโรงแรม รีสอร์ท เอเจนซี่ทัวร์ และธุรกิจท่องเที่ยวที่มีผู้เข้าชมสูง",
    features: [
      "2,000 API Credits (มากกว่า Standard ถึง 20 เท่า)",
      "สร้างแชทบอทได้สูงสุด 25 บอท",
      "รองรับโมเดลขั้นสูง Gemini 3.8 Flash และ Gemini 2.5 Pro",
      "จัดเก็บฐานความรู้เวกเตอร์ไม่จำกัดขนาดเอกสาร",
      "วิเคราะห์สถิติการใช้งานและแหล่งที่มาแบบเรียลไทม์",
      "Rate limit สูงสุด 300 คำขอ/นาที พร้อมลำดับความสำคัญพิเศษ",
    ],
    highlighted: true,
  },
};

export const PLAN_LIST: PlanDefinition[] = [PLANS.STANDARD, PLANS.PRO_MAX];

export function normalizePlanId(plan?: string | null): PlanId {
  if (!plan) return "STANDARD";
  const upper = plan.toUpperCase().trim();
  if (upper === "PRO_MAX" || upper === "PRO MAX" || upper === "PROMAX") {
    return "PRO_MAX";
  }
  return "STANDARD";
}

export function getPlanConfig(plan?: string | null): PlanDefinition {
  return PLANS[normalizePlanId(plan)];
}
