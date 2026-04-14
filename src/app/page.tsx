export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-950 px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-sm text-purple-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            AI-powered social marketing
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">
            Whop Social Agent
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Automate your Reddit, X, and TikTok marketing. Find opportunities, generate posts, and engage your community — all on autopilot.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: "Hunt", desc: "Find Reddit opportunities" },
            { label: "Generate", desc: "AI-crafted posts" },
            { label: "Monitor", desc: "Reply to comments" },
          ].map((f) => (
            <div key={f.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-white font-semibold text-sm">{f.label}</div>
              <div className="text-gray-500 text-xs mt-1">{f.desc}</div>
            </div>
          ))}
        </div>

        <a
          href="/api/auth/login"
          className="inline-flex items-center justify-center gap-3 w-full bg-purple-600 hover:bg-purple-500 transition-colors text-white font-semibold text-lg rounded-xl px-8 py-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
          Sign in with Whop
        </a>

        <p className="text-gray-600 text-sm">
          Only accessible to Whop creators. Your data is private and encrypted.
        </p>
      </div>
    </main>
  );
}
