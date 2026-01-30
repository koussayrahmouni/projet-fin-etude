"use client";

import { useState } from "react";
import { authClient } from '@/lib/auth-client';
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setMessage(null);

  try {
    const { error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage({
        text: error.message || "Invalid email or password",
        type: "error",
      });
      setLoading(false);
      return;
    }

    // Get the logged-in user info after login
    const res = await fetch("/api/me"); // you need an endpoint to get session user
    const user = await res.json();

    // Redirect based on role
    switch (user.role) {
      case "superadmin":
        router.push("/superadmin");
        break;
      case "admin":
        router.push("/admin");
        break;
      case "collaborator":
        router.push("/workspace");
        break;
      case "client":
      default:
        router.push("/dashboard");
    }

    router.refresh();
  } catch (err) {
    setMessage({
      text: "Something went wrong. Please try again.",
      type: "error",
    });
  } finally {
    setLoading(false);
  }
};


  const handleGoogleSignIn = () => {
    authClient.signIn.social({
      provider: "google",
      callbackUrl: "/excel", // redirects to /excel after successful Google sign-in
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* Message banner */}
        {message && (
          <div
            className={cn(
              "mb-6 p-4 rounded-lg text-sm font-medium text-center",
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            )}
          >
            {message.text}
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
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
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
                </Field>

                <div className="flex flex-col gap-3 pt-4">
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

                  <FieldDescription className="text-center text-sm">
                    Don't have an account?{" "}
                    <a href="/register" className="underline">
                      Sign up
                    </a>
                  </FieldDescription>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}