"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, LayoutDashboard, ListChecks, Settings2, Ticket as TicketIcon } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import type {
  ApiTicketMessageDto,
  ApiTicketResponse,
  ApiUserDto,
} from "@/lib/api-types";
import {
  mapApiMessageToResponse,
  mapApiTicketToUi,
  mapUiPriorityToApi,
  mapUiStatusToApi,
} from "@/lib/ticket-mappers";
import {
  buildTechnicianProfile,
  type TechnicianProfile,
} from "@/data/technician-profiles";
import { ClientDashboard } from "@/components/client-dashboard";
import { TechnicianDashboard } from "@/components/technician-dashboard";
import { AdminDashboard } from "@/components/admin-dashboard";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { useCategories } from "@/services/useCategories";
import type { CategoriesData } from "@/services/categories-types";
import type { Ticket, TicketStatus } from "@/types";

export default function Home() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const { categories: categoriesData, save: saveCategories } = useCategories();
  const categoriesRef = useRef<CategoriesData>(categoriesData);
  const [activeView, setActiveView] = useState<string>("");

  const getDefaultViewForRole = (role: "client" | "engineer" | "admin") => {
    switch (role) {
      case "admin":
        return "admin.tickets";
      case "engineer":
        return "engineer.assigned";
      default:
        return "client.tickets";
    }
  };

  const categoriesReady = Object.keys(categoriesData).length > 0;

  useEffect(() => {
    categoriesRef.current = categoriesData;
  }, [categoriesData]);

  const loadTickets = async (
    authToken: string,
    categorySnapshot: CategoriesData
  ) => {
    try {
      const apiTickets = await apiRequest<ApiTicketResponse[]>("/api/tickets", {
        token: authToken,
      });

      const mapped = await Promise.all(
        apiTickets.map(async (apiTicket) => {
          const messages = await apiRequest<ApiTicketMessageDto[]>(
            `/api/tickets/${apiTicket.id}/messages`,
            {
              token: authToken,
            }
          );

          return mapApiTicketToUi(
            apiTicket,
            categorySnapshot,
            messages.map(mapApiMessageToResponse)
          );
        })
      );

      setTickets(mapped);
    } catch (error) {
      console.error("Failed to load tickets", error);
      setTickets([]);
    }
  };

  const loadTechnicians = async (authToken: string) => {
    try {
      const apiTechnicians = await apiRequest<ApiUserDto[]>(
        "/api/users/technicians",
        { token: authToken }
      );
      setTechnicians(apiTechnicians.map(buildTechnicianProfile));
    } catch (error) {
      console.error("Failed to load technicians", error);
      setTechnicians([]);
    }
  };

  // Redirect unauthenticated users to the login page
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token || !user) {
      setTickets([]);
      setTechnicians([]);
      return;
    }

    void loadTickets(token, categoriesReady ? categoriesRef.current : {});

    if (user.role === "admin") {
      void loadTechnicians(token);
    } else {
      setTechnicians([]);
    }
  }, [token, user, categoriesReady]);

  // -------- Ticket handlers (single definitions) --------

  const handleTicketCreate = async (draft: Ticket) => {
    if (!token) return false;

    const category = categoriesRef.current[draft.category];
    if (!category?.backendId) {
      console.warn("Missing category mapping for", draft.category);
      return false;
    }

    try {
      const created = await apiRequest<ApiTicketResponse>("/api/tickets", {
        method: "POST",
        token,
        body: {
          title: draft.title,
          description: draft.description,
          categoryId: category.backendId,
          subcategoryId: draft.subcategory
            ? category.subIssues[draft.subcategory]?.backendId
            : undefined,
          priority: mapUiPriorityToApi(draft.priority),
        },
      });

      const ticket = mapApiTicketToUi(created, categoriesRef.current, []);
      setTickets((prev) => [ticket, ...prev]);
      return true;
    } catch (error) {
      console.error("Failed to create ticket", error);
      return false;
    }
  };

  const handleTicketUpdate = async (
    ticketId: string,
    updates: Partial<Ticket>
  ) => {
    if (!token) return;

    const payload: Record<string, unknown> = {};

    if (updates.status) {
      payload.status = mapUiStatusToApi(updates.status);
    }
    if (updates.priority) {
      payload.priority = mapUiPriorityToApi(updates.priority);
    }
    if (typeof updates.assignedTo !== "undefined") {
      payload.assignedToUserId = updates.assignedTo;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    try {
      const updatedTicket = await apiRequest<ApiTicketResponse>(
        `/api/tickets/${ticketId}`,
        {
          method: "PATCH",
          token,
          body: payload,
        }
      );

      const messages = await apiRequest<ApiTicketMessageDto[]>(
        `/api/tickets/${ticketId}/messages`,
        { token }
      );
      const mapped = mapApiTicketToUi(
        updatedTicket,
        categoriesRef.current,
        messages.map(mapApiMessageToResponse)
      );

      setTickets((prev) =>
        prev.map((ticket) => (ticket.id === ticketId ? mapped : ticket))
      );
    } catch (error) {
      console.error("Failed to update ticket", error);
    }
  };

  const handleTicketResponse = async (
    ticketId: string,
    message: string,
    status: TicketStatus
  ) => {
    if (!token) return;

    try {
      await apiRequest<ApiTicketMessageDto>(
        `/api/tickets/${ticketId}/messages`,
        {
          method: "POST",
          token,
          body: {
            message,
            status: mapUiStatusToApi(status),
          },
        }
      );

      const [ticketDetails, messages] = await Promise.all([
        apiRequest<ApiTicketResponse>(`/api/tickets/${ticketId}`, { token }),
        apiRequest<ApiTicketMessageDto[]>(`/api/tickets/${ticketId}/messages`, {
          token,
        }),
      ]);

      const mapped = mapApiTicketToUi(
        ticketDetails,
        categoriesRef.current,
        messages.map(mapApiMessageToResponse)
      );
      setTickets((prev) =>
        prev.map((ticket) => (ticket.id === ticketId ? mapped : ticket))
      );
    } catch (error) {
      console.error("Failed to add response", error);
    }
  };

  // -------- Active view handling --------

  useEffect(() => {
    if (!user) {
      setActiveView("");
      return;
    }

    setActiveView((current) => {
      if (current && current.startsWith(user.role)) {
        return current;
      }
      return getDefaultViewForRole(user.role);
    });
  }, [user]);

  const handleCategoryUpdate = (updatedCategories: CategoriesData) => {
    void saveCategories(updatedCategories);
  };

  const navItems = useMemo<DashboardNavItem[]>(() => {
    if (!user) {
      return [];
    }

    if (user.role === "client") {
      const userTickets = tickets.filter(
        (ticket) => ticket.clientEmail === user.email
      );
      const newTicketCount = userTickets.filter(
        (ticket) => ticket.status === "open"
      ).length;

      return [
        {
          id: "client-overview",
          title: "داشبورد",
          icon: LayoutDashboard,
          target: "client.tickets",
        },
        {
          id: "client-tickets",
          title: "تیکت‌های من",
          icon: TicketIcon,
          children: [
            {
              id: "client-tickets-list",
              title: "همه تیکت‌ها",
              target: "client.tickets",
              badge: userTickets.length,
            },
            {
              id: "client-tickets-create",
              title: "ثبت تیکت جدید",
              target: "client.create",
              badge: newTicketCount > 0 ? "+" : undefined,
            },
          ],
        },
      ];
    }

    if (user.role === "engineer") {
      const technicianTickets = tickets.filter(
        (ticket) => ticket.assignedTechnicianEmail === user.email
      );
      const inProgressCount = technicianTickets.filter(
        (ticket) => ticket.status === "in-progress"
      ).length;
      const closedCount = technicianTickets.filter(
        (ticket) => ticket.status === "resolved" || ticket.status === "closed"
      ).length;

      return [
        {
          id: "engineer-overview",
          title: "داشبورد تکنسین",
          icon: LayoutDashboard,
          target: "engineer.assigned",
        },
        {
          id: "engineer-tickets",
          title: "تیکت‌های ارجاع‌شده",
          icon: ListChecks,
          children: [
            {
              id: "engineer-assigned",
              title: "همه ارجاعات",
              target: "engineer.assigned",
              badge: technicianTickets.length,
            },
            {
              id: "engineer-progress",
              title: "در حال رسیدگی",
              target: "engineer.in-progress",
              badge: inProgressCount,
            },
            {
              id: "engineer-history",
              title: "تاریخچه حل‌شده",
              target: "engineer.history",
              badge: closedCount,
            },
          ],
        },
      ];
    }

    const openTicketsCount = tickets.filter(
      (ticket) => ticket.status === "open"
    ).length;

    return [
      {
        id: "admin-overview",
        title: "داشبورد مدیر",
        icon: LayoutDashboard,
        target: "admin.tickets",
      },
      {
        id: "admin-tickets",
        title: "مدیریت تیکت‌ها",
        icon: TicketIcon,
        children: [
          {
            id: "admin-tickets-all",
            title: "تمام تیکت‌ها",
            target: "admin.tickets",
            badge: tickets.length,
          },
          {
            id: "admin-assignment",
            title: "تخصیص تکنسین",
            target: "admin.assignment",
            badge: openTicketsCount,
          },
        ],
      },
      {
        id: "admin-categories",
        title: "دسته‌بندی‌ها",
        icon: FolderTree,
        children: [
          {
            id: "admin-categories-manage",
            title: "مدیریت دسته‌بندی‌ها",
            target: "admin.categories",
            badge: Object.keys(categoriesData).length,
          },
        ],
      },
      {
        id: "admin-automation",
        title: "تنظیمات خودکارسازی",
        icon: Settings2,
        target: "admin.auto-settings",
      },
    ];
  }, [user, tickets, categoriesData]);

  // -------- Loading & unauthenticated states --------

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-100 mx-auto" />
          <p>در حال هدایت به صفحه ورود...</p>
        </div>
      </div>
    );
  }

  // -------- Main dashboard content --------

  const resolvedActiveView = activeView || getDefaultViewForRole(user.role);

  const dashboardContent = (() => {
    if (user.role === "client") {
      const clientSection: "tickets" | "create" =
        resolvedActiveView === "client.create" ? "create" : "tickets";

      return (
        <ClientDashboard
          tickets={tickets}
          onTicketCreate={handleTicketCreate}
          currentUser={user}
          categoriesData={categoriesData}
          activeSection={clientSection}
        />
      );
    }

    if (user.role === "engineer") {
      const engineerSection: "assigned" | "in-progress" | "history" =
        resolvedActiveView === "engineer.in-progress"
          ? "in-progress"
          : resolvedActiveView === "engineer.history"
          ? "history"
          : "assigned";

      const handleTechnicianSectionChange = (
        section: "assigned" | "in-progress" | "history"
      ) => {
        const next = `engineer.${section}`;
        setActiveView((prev) => (prev === next ? prev : next));
      };

      return (
        <TechnicianDashboard
          tickets={tickets}
          onTicketUpdate={handleTicketUpdate}
          onTicketRespond={handleTicketResponse}
          currentUser={user}
          activeSection={engineerSection}
          onSectionChange={handleTechnicianSectionChange}
        />
      );
    }

    const adminSection:
      | "tickets"
      | "assignment"
      | "categories"
      | "auto-settings" =
      resolvedActiveView === "admin.assignment"
        ? "assignment"
        : resolvedActiveView === "admin.categories"
        ? "categories"
        : resolvedActiveView === "admin.auto-settings"
        ? "auto-settings"
        : "tickets";

    return (
      <AdminDashboard
        tickets={tickets}
        onTicketUpdate={handleTicketUpdate}
        technicians={technicians}
        categoriesData={categoriesData}
        onCategoryUpdate={handleCategoryUpdate}
        activeSection={adminSection}
      />
    );
  })();

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department ?? undefined,
        title: user.phone ?? undefined,
        avatar: user.avatar ?? undefined,
      }}
      navItems={navItems}
      activeItem={resolvedActiveView}
      onSelect={setActiveView}
    >
      {dashboardContent}
    </DashboardShell>
  );
}
