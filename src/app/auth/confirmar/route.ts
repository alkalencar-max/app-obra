import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

// Links dos e-mails de confirmação de conta e de recuperação de senha.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const supabase = await criarClienteServidor();

  const { error } = tokenHash && tipo
    ? await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("link inválido") };

  // Só segue para caminhos internos (ex.: /nova-senha no link de recuperação).
  const proximo = searchParams.get("proximo");
  const destino = proximo?.startsWith("/") && !proximo.startsWith("//") ? proximo : "/";
  return NextResponse.redirect(new URL(error ? "/login?erro=link" : destino, request.url));
}
