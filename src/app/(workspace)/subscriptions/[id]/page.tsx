import { SubscriptionDetail } from "../../../../components/subscription-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SubscriptionDetail id={(await params).id} />;
}
