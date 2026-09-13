import React, { useState } from "react";
import { Link } from "react-router-dom";

import Navbar from "../../components/Navbar";
import { useLanguage } from "../../hooks/useLanguage";

type Language = "en" | "ar";

type SafetyItem = {
  title: string;
  body: string;
};

type SafetySection = {
  id: string;
  icon: string;
  color: string;
  title: string;
  intro: string;
  items: SafetyItem[];
};

type Stat = {
  value: string;
  label: string;
};

type Emergency = {
  label: string;
  number: string;
};

type SafetyContent = {
  dir: "ltr" | "rtl";
  badge: string;
  title: string;
  title1: string;
  subtitle: string;
  effective: string;
  lastUpdated: string;
  stats: Stat[];
  sections: SafetySection[];
  emergencyHeading: string;
  emergencyNote: string;
  emergencies: Emergency[];
  ctaEyebrow: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  footer: {
    desc: string;
    rights: string;
    privacy: string;
    terms: string;
  };
};

const content: Record<Language, SafetyContent> = {
  en: {
    dir: "ltr",
    badge: "Your Safety Matters",
    title: "Safety",
    title1: "Centre",
    subtitle:
      "Guidelines and resources to keep every stay safe and respectful",
    effective: "Updated regularly",
    lastUpdated: "Report incidents 24/7",

    stats: [
      { value: "24/7", label: "Incident reporting" },
      {
        value: "100%",
        label: "Direct payments — no middleman",
      },
      {
        value: "48h",
        label: "Abuse review turnaround",
      },
    ],

    sections: [
      {
        id: "guests",
        icon: "🧳",
        color: "#2563eb",
        title: "Guest Safety Tips",
        intro:
          "Before you book and during your stay, these practices help keep you safe.",
        items: [
          {
            title: "Verify the listing before booking",
            body:
              "Read all reviews carefully. If a property has no reviews yet, message the host with questions before confirming. Look for verified host badges.",
          },
          {
            title: "Keep communication on-platform",
            body:
              "Use Marhaba's messaging system to communicate with hosts. Avoid sharing personal phone numbers or email addresses before a booking is confirmed.",
          },
          {
            title: "Check the address before you travel",
            body:
              "Cross-reference the listed address on a map application before you set off. Contact your host if anything seems unclear.",
          },
          {
            title: "Know the emergency exits",
            body:
              "On arrival, locate fire exits, extinguishers, and the property's first-aid kit. Ask the host if these are not immediately obvious.",
          },
          {
            title: "Share your itinerary",
            body:
              "Let a trusted friend or family member know where you are staying, the host's name, and when you expect to check out.",
          },
          {
            title: "Trust your instincts",
            body:
              "If something feels wrong on arrival — the property doesn't match photos, or you feel unsafe — leave and contact Marhaba support immediately.",
          },
        ],
      },

      {
        id: "hosts",
        icon: "🏠",
        color: "#059669",
        title: "Host Responsibilities",
        intro:
          "Hosts on Marhaba are responsible for providing a safe, honest, and welcoming environment.",
        items: [
          {
            title: "Accurate listing information",
            body:
              "Photos, descriptions, and amenities must truthfully represent the property. Misleading listings violate Marhaba's Terms of Service and may result in account suspension.",
          },
          {
            title: "Safety equipment",
            body:
              "Ensure your property has working smoke detectors, a fire extinguisher, and a first-aid kit. Replace batteries and check equipment before every new guest.",
          },
          {
            title: "Clear emergency information",
            body:
              "Provide guests with local emergency numbers (police, ambulance, fire brigade) and the address of the nearest hospital in your welcome guide.",
          },
          {
            title: "Respect guest privacy",
            body:
              "Hidden cameras or recording devices of any kind are strictly prohibited. Hosts found in violation will be permanently removed from the platform.",
          },
          {
            title: "Secure access",
            body:
              "Change door codes or lock combinations between every guest. Do not share access credentials with third parties.",
          },
          {
            title: "Prompt communication",
            body:
              "Respond to guest messages within a reasonable time. If you are unavailable, set an out-of-office response and provide an emergency contact.",
          },
        ],
      },

      {
        id: "payments",
        icon: "💳",
        color: "#d97706",
        title: "Booking & Payment Safety",
        intro:
          "Marhaba does not process payments. Understanding how transactions work protects both parties.",
        items: [
          {
            title: "Payments are direct between parties",
            body:
              "Marhaba does not handle, hold, or facilitate any money between guests and hosts. All payment arrangements are made privately and directly between the two parties.",
          },
          {
            title: "Agree on payment terms before confirming",
            body:
              "Discuss and agree on amount, method, currency, and refund policy with the host before you confirm a booking. Get written confirmation in the Marhaba chat.",
          },
          {
            title: "Beware of off-platform requests",
            body:
              "Any request asking you to pay through an external link, crypto wallet, or unofficial channel before a booking is confirmed is a red flag. Report it immediately.",
          },
          {
            title: "No refund guarantees from Marhaba",
            body:
              "Because Marhaba does not process payments, we cannot issue refunds. Dispute resolution is between the guest and host directly. Document all payment agreements in writing.",
          },
          {
            title: "Use traceable payment methods",
            body:
              "Where possible, use bank transfers or payment methods that leave a paper trail. Avoid large cash payments with no receipt.",
          },
          {
            title: "Cancellation policies",
            body:
              "Review the host's cancellation policy before booking. It is the guest's responsibility to understand and agree to these terms prior to confirmation.",
          },
        ],
      },

      {
        id: "reporting",
        icon: "🚨",
        color: "#dc2626",
        title: "Reporting Abuse & Incidents",
        intro:
          "We take every report seriously. Here's how to flag issues and what happens next.",
        items: [
          {
            title: "How to report a safety incident",
            body:
              "Go to your dashboard → Bookings → select the booking → 'Report an Issue'. Describe the incident in detail. Our team reviews all reports within 48 hours.",
          },
          {
            title: "What counts as a reportable incident",
            body:
              "Misrepresented listings, hidden cameras, harassment, threats, property damage, no-shows, payment disputes, or any behaviour that makes you feel unsafe.",
          },
          {
            title: "Urgent safety situations",
            body:
              "If you are in immediate danger, contact local emergency services first (police: 1515 in Libya). Then contact Marhaba support at safety@mar-haba.ly.",
          },
          {
            title: "What happens after you report",
            body:
              "Our team will acknowledge your report within 24 hours. Depending on severity, we may suspend the account under review, request evidence, or escalate to authorities.",
          },
          {
            title: "False reports",
            body:
              "Submitting a knowingly false report is a violation of our Terms of Service and may result in account suspension. Please only report genuine incidents.",
          },
          {
            title: "Anonymous reporting",
            body:
              "You may request that your identity be kept confidential during an investigation. We will make reasonable efforts to honour this where legally possible.",
          },
        ],
      },
    ],

    emergencyHeading: "Emergency Contacts in Libya",
    emergencyNote:
      "Save these numbers before your trip. Availability may vary by region.",

    emergencies: [
      { label: "Police", number: "1515" },
      { label: "Ambulance", number: "1120" },
      { label: "Fire Brigade", number: "1122" },
      {
        label: "Marhaba Safety",
        number: "safety@mar-haba.ly",
      },
    ],

    ctaEyebrow: "Need to report something?",
    ctaTitle: "We're here around the clock",
    ctaBody:
      "If you experience or witness anything that compromises safety on Marhaba, don't hesitate to reach out. Every report is reviewed by a real person.",
    ctaButton: "Contact Safety Team",

    footer: {
      desc:
        "Libya's trusted short-term rental platform connecting hosts and travelers.",
      rights: "All rights reserved.",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
    },
  },

  ar: {
    dir: "rtl",
    badge: "سلامتك تهمنا",
    title: "مركز",
    title1: " السلامة",
    subtitle:
      "إرشادات وموارد لضمان إقامة آمنة ومحترمة للجميع",
    effective: "يُحدَّث بانتظام",
    lastUpdated: "الإبلاغ عن الحوادث 24/7",

    stats: [
      {
        value: "24/7",
        label: "الإبلاغ عن الحوادث",
      },
      {
        value: "100%",
        label: "مدفوعات مباشرة — بلا وسيط",
      },
      {
        value: "48h",
        label: "مراجعة بلاغات الإساءة",
      },
    ],

    sections: [
      {
        id: "guests",
        icon: "🧳",
        color: "#2563eb",
        title: "نصائح السلامة للضيوف",
        intro:
          "قبل الحجز وأثناء إقامتك، اتبع هذه الإرشادات لتبقى بأمان.",
        items: [
          {
            title: "تحقق من القائمة قبل الحجز",
            body:
              "اقرأ جميع التقييمات بعناية. إذا لم يكن للعقار تقييمات بعد، راسل المضيف بأسئلتك قبل التأكيد. ابحث عن شارة المضيف الموثَّق.",
          },
          {
            title: "أبقِ التواصل داخل المنصة",
            body:
              "استخدم نظام المراسلة في مرحبا للتواصل مع المضيفين. تجنّب مشاركة أرقام هواتفك الشخصية أو بريدك الإلكتروني قبل تأكيد الحجز.",
          },
          {
            title: "تحقق من العنوان قبل السفر",
            body:
              "راجع العنوان المدرج على تطبيق الخرائط قبل المغادرة. تواصل مع مضيفك إذا كان هناك أي شيء غير واضح.",
          },
          {
            title: "تعرّف على مخارج الطوارئ",
            body:
              "عند الوصول، حدد مخارج الحريق وأجهزة الإطفاء وحقيبة الإسعافات الأولية. اسأل المضيف إن لم تكن ظاهرة بوضوح.",
          },
          {
            title: "شارك جدولك مع شخص موثوق",
            body:
              "أخبر صديقاً أو أحد أفراد عائلتك بمكان إقامتك واسم المضيف وموعد المغادرة المتوقع.",
          },
          {
            title: "ثق بحدسك",
            body:
              "إذا شعرت بشيء غير صحيح عند الوصول — العقار لا يطابق الصور، أو شعرت بعدم الأمان — غادر فوراً وتواصل مع دعم مرحبا.",
          },
        ],
      },

      {
        id: "hosts",
        icon: "🏠",
        color: "#059669",
        title: "مسؤوليات المضيف",
        intro:
          "يتحمل المضيفون في مرحبا مسؤولية توفير بيئة آمنة وصادقة ومرحِّبة.",
        items: [
          {
            title: "معلومات القائمة الدقيقة",
            body:
              "يجب أن تعكس الصور والأوصاف والمرافق العقارَ بصدق تام. القوائم المضللة تنتهك شروط خدمة مرحبا وقد تؤدي إلى تعليق الحساب.",
          },
          {
            title: "معدات السلامة",
            body:
              "تأكد من وجود كاشفات دخان تعمل بكفاءة، ومطفأة حريق، وحقيبة إسعافات أولية. استبدل البطاريات وافحص المعدات قبل كل ضيف جديد.",
          },
          {
            title: "معلومات الطوارئ الواضحة",
            body:
              "زوّد الضيوف بأرقام الطوارئ المحلية (الشرطة، الإسعاف، الإطفاء) وعنوان أقرب مستشفى في دليل الترحيب.",
          },
          {
            title: "احترام خصوصية الضيف",
            body:
              "الكاميرات الخفية أو أجهزة التسجيل بأي شكل محظورة حظراً صارماً. سيُزال المضيفون المخالفون نهائياً من المنصة.",
          },
          {
            title: "الوصول الآمن",
            body:
              "غيّر رموز الأبواب أو مفاتيح القفل بين كل ضيف وآخر. لا تشارك بيانات الوصول مع أطراف ثالثة.",
          },
          {
            title: "التواصل الفوري",
            body:
              "رد على رسائل الضيوف في وقت معقول. إذا كنت غير متاح، ضع رداً تلقائياً وقدّم جهة اتصال للطوارئ.",
          },
        ],
      },

      {
        id: "payments",
        icon: "💳",
        color: "#d97706",
        title: "سلامة الحجز والمدفوعات",
        intro:
          "مرحبا لا تعالج المدفوعات. فهم آلية المعاملات يحمي كلا الطرفين.",
        items: [
          {
            title: "المدفوعات مباشرة بين الطرفين",
            body:
              "لا تتعامل مرحبا بأي أموال بين الضيوف والمضيفين ولا تحتفظ بها. تُرتَّب جميع ترتيبات الدفع بصورة خاصة ومباشرة بين الطرفين.",
          },
          {
            title: "اتفق على شروط الدفع قبل التأكيد",
            body:
              "ناقش المبلغ والطريقة والعملة وسياسة الاسترداد مع المضيف قبل تأكيد الحجز. احصل على تأكيد كتابي عبر محادثة مرحبا.",
          },
          {
            title: "احذر من الطلبات خارج المنصة",
            body:
              "أي طلب يدعوك للدفع عبر رابط خارجي أو محفظة عملات رقمية أو قناة غير رسمية قبل تأكيد الحجز يُعدّ إشارة تحذير. أبلغ عنه فوراً.",
          },
          {
            title: "لا ضمانات استرداد من مرحبا",
            body:
              "بما أن مرحبا لا تعالج المدفوعات، فلا يمكنها إصدار استردادات. يكون حل النزاعات مباشرةً بين الضيف والمضيف. وثّق جميع اتفاقيات الدفع كتابةً.",
          },
          {
            title: "استخدم طرق دفع قابلة للتتبع",
            body:
              "كلما أمكن، استخدم التحويلات المصرفية أو طرق الدفع التي تترك سجلاً واضحاً. تجنّب المدفوعات النقدية الكبيرة دون إيصال.",
          },
          {
            title: "سياسات الإلغاء",
            body:
              "راجع سياسة الإلغاء الخاصة بالمضيف قبل الحجز. يقع على عاتق الضيف فهم هذه الشروط والموافقة عليها قبل التأكيد.",
          },
        ],
      },

      {
        id: "reporting",
        icon: "🚨",
        color: "#dc2626",
        title: "الإبلاغ عن الإساءة والحوادث",
        intro:
          "نأخذ كل بلاغ بجدية تامة. إليك كيفية الإبلاغ وما يحدث بعد ذلك.",
        items: [
          {
            title: "كيفية الإبلاغ عن حادثة أمنية",
            body:
              "انتقل إلى لوحة التحكم ← الحجوزات ← اختر الحجز ← 'الإبلاغ عن مشكلة'. صف الحادثة بالتفصيل. يراجع فريقنا جميع البلاغات خلال 48 ساعة.",
          },
          {
            title: "ما الذي يُعدّ حادثة قابلة للإبلاغ",
            body:
              "القوائم المضللة، الكاميرات الخفية، التحرش، التهديدات، إتلاف الممتلكات، حالات عدم الحضور، نزاعات الدفع، أو أي سلوك يجعلك تشعر بعدم الأمان.",
          },
          {
            title: "حالات الطوارئ الأمنية العاجلة",
            body:
              "إذا كنت في خطر فوري، تواصل مع خدمات الطوارئ المحلية أولاً (الشرطة: 1515 في ليبيا). ثم تواصل مع دعم مرحبا على safety@mar-haba.ly.",
          },
          {
            title: "ما الذي يحدث بعد تقديم البلاغ",
            body:
              "سيُقرّ فريقنا باستلام بلاغك خلال 24 ساعة. حسب درجة الخطورة، قد نعلّق الحساب قيد المراجعة أو نطلب أدلة أو نحيل الأمر للجهات المختصة.",
          },
          {
            title: "البلاغات الكاذبة",
            body:
              "تقديم بلاغ كاذب عمداً يُعدّ انتهاكاً لشروط خدمتنا وقد يؤدي إلى تعليق الحساب. يرجى الإبلاغ عن الحوادث الحقيقية فقط.",
          },
          {
            title: "الإبلاغ بصورة مجهولة",
            body:
              "يمكنك طلب إبقاء هويتك سرية أثناء التحقيق. سنبذل جهوداً معقولة للوفاء بهذا الطلب في حدود ما يسمح به القانون.",
          },
        ],
      },
    ],

    emergencyHeading: "جهات الطوارئ في ليبيا",
    emergencyNote:
      "احفظ هذه الأرقام قبل رحلتك. قد يتفاوت التوفر حسب المنطقة.",

    emergencies: [
      {
        label: "الشرطة",
        number: "1515",
      },
      {
        label: "الإسعاف",
        number: "1120",
      },
      {
        label: "الإطفاء",
        number: "1122",
      },
      {
        label: "سلامة مرحبا",
        number: "safety@mar-haba.ly",
      },
    ],

    ctaEyebrow: "هل تريد الإبلاغ عن شيء؟",
    ctaTitle: "نحن هنا على مدار الساعة",
    ctaBody:
      "إذا تعرضت أو شهدت أي شيء يهدد السلامة على مرحبا، لا تتردد في التواصل معنا. يراجع كل بلاغ شخص حقيقي من فريقنا.",
    ctaButton: "تواصل مع فريق السلامة",

    footer: {
      desc:
        "منصة التأجير قصير الأمد الموثوقة في ليبيا تربط المضيفين والمسافرين.",
      rights: "جميع الحقوق محفوظة.",
      privacy: "سياسة الخصوصية",
      terms: "شروط الخدمة",
    },
  },
};

const sectionColorMap: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    dot: string;
  }
> = {
  "#2563eb": {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  "#059669": {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  "#d97706": {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  "#dc2626": {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

const SafetyPage: React.FC = () => {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const { lang, toggleLanguage } = useLanguage();

  const currentLang = lang as Language;
  const c = content[currentLang] ?? content.en;
  const isAr = currentLang === "ar";

  const navLinks = [
    {
      id: "home",
      label: isAr ? "→ الرئيسية" : "← Home",
      href: "/",
    },
  ];

  const toggle = (sectionId: string, index: number) => {
    const key = `${sectionId}-${index}`;

    setOpenItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isOpen = (sectionId: string, index: number) => {
    return !!openItems[`${sectionId}-${index}`];
  };

  return (
    <div
      dir={c.dir}
      className="min-h-screen bg-white text-gray-900"
    >
      {/* ============================================================
          NAVBAR
      ============================================================ */}
      <Navbar
        NAV_LINKS={navLinks}
        user={null}
        lang={lang}
        toggleLanguage={toggleLanguage}
      />

      {/* ============================================================
          HERO
      ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#2d2d5e] to-[#1a1a2e] px-6 py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(232,197,71,0.12)_0%,transparent_60%)]" />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,#e8c547 0px,#e8c547 1px,transparent 1px,transparent 40px)",
          }}
        />

        <div className="relative mx-auto max-w-screen-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/15 px-3.5 py-1.5 text-[11px] uppercase tracking-widest text-yellow-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
            {c.badge}
          </div>

          <h1
            className={`mb-3 text-[clamp(32px,5vw,56px)] font-light leading-[1.1] text-white ${
              isAr
                ? "font-['Cairo','Tajawal',sans-serif]"
                : "font-['Fraunces',serif] italic"
            }`}
          >
            {c.title}
            <span className="font-bold text-[#e8c547]">
              {" "}
              {c.title1}
            </span>
          </h1>

          <p className="mb-7 text-[15px] text-white/50">
            {c.subtitle}
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            {c.stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5"
              >
                <span className="text-[15px] font-bold text-yellow-400">
                  {stat.value}
                </span>

                <span className="text-[11px] text-white/40">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION NAVIGATION
      ============================================================ */}
      <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 px-4 backdrop-blur sm:px-6">
        <div className="scrollbar-hide mx-auto flex max-w-screen-xl gap-1 overflow-x-auto py-3">
          {c.sections.map((section) => {
            const colors = sectionColorMap[section.color];

            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold no-underline transition-colors ${colors.bg} ${colors.text} ${colors.border}`}
              >
                <span>{section.icon}</span>
                {section.title}
              </a>
            );
          })}
        </div>
      </div>

      {/* ============================================================
          MAIN CONTENT
      ============================================================ */}
      <main className="mx-auto flex max-w-screen-xl flex-col gap-16 px-4 py-14 sm:px-6">
        {c.sections.map((section) => {
          const colors = sectionColorMap[section.color];

          return (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24"
            >
              {/* Section Header */}
              <div className="mb-6 flex items-start gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                  style={{
                    background: `${section.color}18`,
                  }}
                >
                  {section.icon}
                </span>

                <div>
                  <h2
                    className={`mb-1 text-[22px] font-semibold leading-tight text-gray-900 ${
                      isAr
                        ? "font-['Cairo','Tajawal',sans-serif]"
                        : ""
                    }`}
                  >
                    {section.title}
                  </h2>

                  <p className="text-[13px] leading-[1.7] text-gray-500">
                    {section.intro}
                  </p>
                </div>
              </div>

              {/* Accordion */}
              <div className="ms-0 grid grid-cols-1 gap-3 md:ms-16 md:grid-cols-2">
                {section.items.map((item, index) => {
                  const itemOpen = isOpen(
                    section.id,
                    index
                  );

                  return (
                    <div
                      key={`${section.id}-${index}`}
                      className="overflow-hidden rounded-2xl border transition-all"
                      style={{
                        borderColor: itemOpen
                          ? section.color
                          : "#e5e7eb",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggle(section.id, index)
                        }
                        aria-expanded={itemOpen}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-white px-5 py-4 text-start"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`}
                          />

                          <span
                            className={`text-[13px] font-semibold leading-[1.5] text-gray-900 ${
                              isAr
                                ? "font-['Cairo','Tajawal',sans-serif]"
                                : ""
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors"
                          style={{
                            background: itemOpen
                              ? section.color
                              : "#f3f4f6",
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            className={`transition-transform duration-200 ${
                              itemOpen ? "rotate-180" : ""
                            }`}
                            aria-hidden="true"
                          >
                            <path
                              d="M2 3.5l3 3 3-3"
                              stroke={
                                itemOpen
                                  ? "#fff"
                                  : "#6b7280"
                              }
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </button>

                      {itemOpen && (
                        <div
                          className="border-t px-5 pb-4"
                          style={{
                            background: `${section.color}08`,
                            borderColor: `${section.color}22`,
                          }}
                        >
                          <p className="pt-3 text-[13px] leading-[1.8] text-gray-600">
                            {item.body}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* ============================================================
            EMERGENCY CONTACTS
        ============================================================ */}
        <section>
          <div className="mb-6 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-2xl">
              📞
            </span>

            <div>
              <h2
                className={`mb-1 text-[22px] font-semibold leading-tight text-gray-900 ${
                  isAr
                    ? "font-['Cairo','Tajawal',sans-serif]"
                    : ""
                }`}
              >
                {c.emergencyHeading}
              </h2>

              <p className="text-[13px] text-gray-500">
                {c.emergencyNote}
              </p>
            </div>
          </div>

          <div className="ms-0 grid grid-cols-2 gap-3 md:ms-16 sm:grid-cols-4">
            {c.emergencies.map((emergency) => {
              const isEmail = emergency.number.includes("@");

              return (
                <div
                  key={emergency.label}
                  className="flex flex-col gap-1.5 rounded-2xl border border-gray-200 p-4 transition-all hover:border-red-300 hover:shadow-sm"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {emergency.label}
                  </span>

                  {isEmail ? (
                    <a
                      href={`mailto:${emergency.number}`}
                      className="break-all text-[13px] font-bold text-[#1a1a2e] no-underline transition-colors hover:text-yellow-600"
                    >
                      {emergency.number}
                    </a>
                  ) : (
                    <a
                      href={`tel:${emergency.number}`}
                      className="text-[22px] font-bold tracking-tight text-[#1a1a2e] no-underline transition-colors hover:text-yellow-600"
                    >
                      {emergency.number}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ============================================================
          CTA
      ============================================================ */}
      <section className="relative mx-4 mb-10 overflow-hidden rounded-3xl bg-[#1a1a2e] px-8 py-12 sm:mx-6 lg:mx-auto lg:max-w-screen-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,197,71,0.18)_0%,transparent_65%)]" />

        <div className="relative z-10 text-center">
          <div className="mb-3 text-[10px] uppercase tracking-[0.12em] text-yellow-400/60">
            {c.ctaEyebrow}
          </div>

          <h3
            className={`mb-3 text-[clamp(22px,4vw,36px)] font-light leading-[1.2] text-white ${
              isAr
                ? "font-['Cairo','Tajawal',sans-serif]"
                : "font-['Fraunces',serif] italic"
            }`}
          >
            {c.ctaTitle}
          </h3>

          <p className="mx-auto mb-7 max-w-[440px] text-[14px] leading-[1.75] text-white/45">
            {c.ctaBody}
          </p>

          <a
            href="mailto:safety@mar-haba.ly"
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-7 py-3.5 text-sm font-bold text-[#1a1a2e] no-underline transition-colors hover:bg-yellow-300"
          >
            🚨 {c.ctaButton}
          </a>
        </div>
      </section>

      {/* ============================================================
          FOOTER
      ============================================================ */}
      <footer className="bg-[#111] px-6 pb-7 pt-12">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-5 border-b border-[#222] pb-8">
            <Link
              to="/"
              className="no-underline"
              style={{
                textDecoration: "none",
                fontFamily: "'Cairo','Tajawal',sans-serif",
                fontWeight: 500,
                fontSize: "26px",
                color: "#fff",
                letterSpacing: "1px",
              }}
            >
              مر
              <span
                style={{
                  fontWeight: 700,
                  color: "#e8c547",
                }}
              >
                حبا
              </span>
            </Link>

            <p className="max-w-xs text-sm leading-[1.7] text-[#555]">
              {c.footer.desc}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#444]">
              &copy; {new Date().getFullYear()} Marhaba.{" "}
              {c.footer.rights}
            </p>

            <div className="flex gap-5">
              <Link
                to="/privacy"
                className="text-xs text-[#999] no-underline transition-colors hover:text-yellow-400"
              >
                {c.footer.privacy}
              </Link>

              <Link
                to="/terms"
                className="text-xs text-[#999] no-underline transition-colors hover:text-yellow-400"
              >
                {c.footer.terms}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SafetyPage;