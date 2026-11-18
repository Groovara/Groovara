import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AopAdminDashboard } from "./aop-admin-dashboard";

const PARTNER_SLUG = "aop";

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    notFound();
  }

  const { data: canManage, error: accessError } = await supabase.rpc(
    "can_manage_partner",
    {
      target_partner_slug: PARTNER_SLUG,
    },
  );

  if (accessError || canManage !== true) {
    notFound();
  }

  return <AopAdminDashboard userId={user.id} />;
}
