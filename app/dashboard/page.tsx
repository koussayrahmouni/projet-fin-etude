"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { LayoutDashboard, Workflow, FileText, Settings } from "lucide-react" // Assuming lucide-react is installed for icons

export default function DashboardPage() {
  // Placeholder data - in real app, fetch from n8n API or backend
  const overallProgress = 75
  const sections = [
    { name: "Jira Integration", progress: 80, items: 4, completed: 3 },
    { name: "Dollar Universe", progress: 60, items: 12, completed: 7 },
    { name: "Security Checks", progress: 90, items: 15, completed: 13 },
    { name: "System & Infrastructure", progress: 50, items: 12, completed: 6 },
  ]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Build-to-Run Checklist Dashboard</h1>
          </div>
        </header>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 md:gap-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Build-to-Run Checklist Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold tracking-tight">Overall Progress</h2>
                      <p className="text-sm text-muted-foreground">
                        Automate your Build-to-Run process with n8n and Next.js
                      </p>
                    </div>
                    <Button>Trigger Validation</Button>
                  </div>
                  <div className="flex items-center gap-4">
                    <Progress value={overallProgress} className="flex-1" />
                    <span className="text-2xl font-bold">{overallProgress}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {sections.map((section) => (
              <Card key={section.name}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{section.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{section.completed}/{section.items}</div>
                  <Progress value={section.progress} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {section.progress}% complete
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}