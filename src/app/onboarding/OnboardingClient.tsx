"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function OnboardingClient({ userId: _userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    openRouterKey: "",
    whopApiKey: "",
    redditAccountId: "",
    twitterConnectionToken: "",
  });
  const [saving, setSaving] = useState(false);

  const steps = [
    {
      title: "Welcome to Whop Social Agent 👋",
      desc: "Let's get you set up in 2 minutes. You'll need a few API keys to connect your accounts.",
    },
    {
      title: "OpenRouter API Key",
      desc: "Used to power AI post generation. Get a free key at openrouter.ai.",
      field: "openRouterKey",
      placeholder: "sk-or-v1-...",
      type: "password",
      required: false,
    },
    {
      title: "Whop API Key (optional)",
      desc: "Lets the agent sync your Whop products automatically. Found in your Whop developer settings.",
      field: "whopApiKey",
      placeholder: "api_...",
      type: "password",
      required: false,
    },
    {
      title: "Reddit via Composio",
      desc: "Connect your Reddit account through Composio (composio.dev) and paste your Connected Account ID here.",
      field: "redditAccountId",
      placeholder: "ca_...",
      type: "text",
      required: false,
    },
    {
      title: "X / Twitter (optional)",
      desc: "Paste your X/Twitter bearer token to enable automated tweet posting.",
      field: "twitterConnectionToken",
      placeholder: "Bearer token...",
      type: "password",
      required: false,
    },
  ];

  async function finish() {
    setSaving(true);
    try {
      const r = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, onboarded: true }),
      });
      if (r.ok) {
        toast.success("You're all set!");
        router.push("/dashboard");
      } else {
        toast.error("Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  }

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Progress */}
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-purple-500" : "bg-gray-800"}`}
            />
          ))}
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-white">{current.title}</h1>
          <p className="text-gray-400 leading-relaxed">{current.desc}</p>

          {current.field && (
            <input
              type={current.type}
              value={form[current.field as keyof typeof form]}
              onChange={(e) => setForm({ ...form, [current.field!]: e.target.value })}
              placeholder={current.placeholder}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm"
            />
          )}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={finish}
              disabled={saving}
              className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {saving ? "Saving…" : "Go to Dashboard →"}
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {step === 0 ? "Get Started →" : "Next →"}
            </button>
          )}
        </div>

        {step > 0 && (
          <p className="text-center text-xs text-gray-600">
            All fields optional — you can add these later in Controls
          </p>
        )}
      </div>
    </main>
  );
}
