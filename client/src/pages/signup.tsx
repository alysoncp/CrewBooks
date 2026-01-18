import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/signin",
        },
      });
      if (error) throw error;
      // If email confirmation is enabled, Supabase will require email verification
      if (data?.user && !data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
      }
      // If email confirmation is disabled, a session may be returned and App will redirect to '/'
    } catch (err: any) {
      setError(err?.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2"
              placeholder="Create a strong password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account? <Link href="/signin" className="text-primary">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
