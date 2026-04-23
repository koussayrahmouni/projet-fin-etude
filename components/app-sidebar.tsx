"use client"

import * as React from "react"
import {
  IconCamera, IconChecklist, IconDashboard, IconDatabase,
  IconFileAi, IconFileDescription, IconFileWord,
  IconInnerShadowTop, IconListDetails, IconReport,
} from "@tabler/icons-react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client" // ← add

const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconDashboard,
    isActive: true,
    items: [
      { title: "Workflows", url: "/workflows" },
      { title: "Reports", url: "/reports" },
    ],
  },
  {
    title: "Parsing",
    url: "/excel",
    icon: IconListDetails,
  },
  {
    title: "Checklist",
    url: "/checklist",
    icon: IconChecklist,
    items: [
      { title: "Manage", url: "/checklist" },
      { title: "Excel Editor", url: "/checklist/excel" },
    ],
  },
    {
    title: "Zabbix",
    url: "/zabbix",
    icon: IconListDetails,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session, isPending } = authClient.useSession() // ← get real session

  const user = {
    name: session?.user?.name ?? "...",
    email: session?.user?.email ?? "...",
    avatar: session?.user?.image ?? "",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">B2R</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        {isPending ? null : <NavUser user={user} />} {/* ← wait for session */}
      </SidebarFooter>
    </Sidebar>
  )
}