// app/register/page.tsx
"use client";

import { useState } from "react";
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
import { createAuthClient } from "better-auth/client"; // Adjust import if your setup uses a different path (e.g., "@/lib/auth-client")

const authClient = createAuthClient();

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Client-side validation
    if (password !== confirmPassword) {
      setMessage({ text: "Passwords do not match", type: "error" });
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters", type: "error" });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name: name || undefined,
        // If you have email verification enabled and want to redirect after verification:
        // callbackURL: "/excel",
      });

      if (error) {
        console.error("Signup error:", error);
        setMessage({
          text: error.message || "Registration failed. Try again.",
          type: "error",
        });
        return;
      }

      // Success: Better Auth typically creates a session automatically after signup
      console.log("Signup successful:", data);

      setMessage({
        text: "Account created successfully! Logging you in...",
        type: "success",
      });

      setTimeout(() => {
        router.push("/excel");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      console.error("Unexpected signup error:", err);
      setMessage({
        text: err.message || "Network error or server issue. Check console for details.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
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
              <CardTitle>Create an account</CardTitle>
              <CardDescription>
                Enter your details below to create a new account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Name (optional)</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </Field>

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
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <FieldDescription>Minimum 8 characters</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </Field>

                <div className="flex flex-col gap-3 pt-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating account..." : "Sign up"}
                  </Button>

                  <FieldDescription className="text-center text-sm">
                    Already have an account?{" "}
                    <a href="/login" className="underline">
                      Log in
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