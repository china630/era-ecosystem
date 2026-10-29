import FbPosNav from "@/components/FbPosNav";
import BuffetAdminPanel from "@/components/BuffetAdminPanel";

export default function BuffetManagementPage() {
  return (
    <>
      <FbPosNav />
      <BuffetAdminPanel section="management" />
    </>
  );
}
