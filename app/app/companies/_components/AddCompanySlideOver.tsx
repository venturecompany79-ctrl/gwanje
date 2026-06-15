import { LinkButton } from "@/components/ui/Button";
import { IconPlus } from "@/components/ui/icons";

export function AddCompanyButton({ size = "sm" }: {
  demo: boolean;
  size?: "md" | "sm";
}) {
  return (
    <LinkButton variant="cta" size={size} href="/app/companies/new">
      <IconPlus /> 기업 추가
    </LinkButton>
  );
}
