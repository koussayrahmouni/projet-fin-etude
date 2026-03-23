"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectByRole = (role: string | undefined) => {
    switch (role) {
      case "superadmin":
        router.push("/superadmin");
        break;
      case "admin":
        router.push("/admin");
        break;
      case "collaborator":
        router.push("/workspace");
        break;
      default:
        router.push("/dashboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message || "Invalid email or password");
      setLoading(false);
      return;
    }

    // role lives on data.user — no extra fetch needed
    const role = (data?.user as any)?.role as string | undefined;
    redirectByRole(role);

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {error && (
          <div className="mb-6 p-4 rounded-lg text-sm font-medium text-center bg-red-50 text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Login to your account</CardTitle>
              <CardDescription>
                Enter your email below to login to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>

                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Login"}
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  Continue with Google
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <a href="/register" className="underline">
                    Sign up
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}