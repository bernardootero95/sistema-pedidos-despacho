import { forwardRef } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { TURNSTILE_SITE_KEY, captchaEnabled } from "../../config/captcha";

/**
 * Envuelve Cloudflare Turnstile (auditoría #12). Sin VITE_TURNSTILE_SITE_KEY
 * configurada -tenant que todavía no activó CAPTCHA en Supabase- no
 * renderiza nada y los formularios siguen funcionando sin captchaToken,
 * mismo patrón que VITE_SENTRY_DSN opcional.
 */
export const CaptchaWidget = forwardRef(({ onVerify, onExpire }, ref) => {
  if (!captchaEnabled) return null;

  return (
    <Turnstile
      ref={ref}
      siteKey={TURNSTILE_SITE_KEY}
      options={{ size: "flexible" }}
      onSuccess={onVerify}
      onExpire={onExpire}
    />
  );
});

CaptchaWidget.displayName = "CaptchaWidget";
