import { Home, Table2, LineChart, FileText, TrendingUp, Bell, Zap } from "lucide-react";
import { NavLink } from "@/components/NavLink";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Tabell", url: "/tabell", icon: Table2 },
  { title: "Grafer", url: "/grafer", icon: LineChart },
  { title: "Rapporter", url: "/rapporter", icon: FileText },
];

const analysisItems = [
  { title: "Advanced Analytics", url: "/advanced-analytics", icon: Zap },
  { title: "SSI", url: "/ssi", icon: TrendingUp },
  { title: "Cross-Sectional Dispersion", url: "/dispersion", icon: TrendingUp },
  { title: "Kapitalrotasjon", url: "/rotation", icon: TrendingUp },
  { title: "Relativ Ytelse", url: "/performance", icon: LineChart },
  { title: "Abnormal Volume", url: "/abnormal-volume", icon: Bell },
  { title: "VDI", url: "/vdi", icon: TrendingUp },
  { title: "LARS", url: "/lars", icon: TrendingUp },
  { title: "SMFI", url: "/smfi", icon: TrendingUp },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar
      className={collapsed ? "w-14" : "w-60"}
      collapsible="icon"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Hovedmeny</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Avansert Analyse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
