"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Network, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabaseConfigured = isSupabaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in email and password");
      return;
    }

    setLoading(true);
    try {
      if (supabaseConfigured) {
        const supabase = createClient();
        if (supabase) {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) {
            toast.error(error.message);
            setLoading(false);
            return;
          }
        }
      }
      toast.success("Welcome back to NEURON");
      router.push("/app/semesters");
    } catch (err: any) {
      toast.error(err?.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    toast.success("Entering NEURON academic workspace");
    router.push("/app/semesters");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-10 w-10 rounded-sm bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold tracking-tighter">
            <Network className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">NEURON</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Personal Academic Intelligence
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 border border-border p-6 rounded-md bg-card">
          <div className="space-y-1.5">
            <Label htmlFor="email">University Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="student@univ.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Authenticating..." : "Sign In"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full text-xs font-mono"
            onClick={handleDemoAccess}
          >
            Instant Workspace Access
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-foreground underline underline-offset-4 font-medium">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
