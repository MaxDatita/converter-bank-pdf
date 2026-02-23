import { Resend } from "resend"

// Inicializar Resend solo si tenemos la API key
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Configuración de email
const EMAIL_CONFIG = {
  // Cambiar por tu dominio verificado o usar el de prueba de Resend
  from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
  // Nombre que aparecerá en el email
  fromName: "Conversor Bancario",
}

export class EmailService {
  async sendVerificationCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      // En desarrollo, si no hay API key de Resend, simular el envío
      if (!resend || !process.env.RESEND_API_KEY) {
        console.log(`📧 [DESARROLLO] Código de verificación para ${email}: ${code}`)
        console.log(`💡 Para usar emails reales, configura RESEND_API_KEY en tu .env.local`)
        return {
          success: true,
          message: `Código enviado a ${email}. En desarrollo, revisa la consola del servidor.`,
        }
      }

      const { data, error } = await resend.emails.send({
        from: `${EMAIL_CONFIG.fromName} <${EMAIL_CONFIG.from}>`,
        to: [email],
        subject: "🔐 Tu código de verificación - Conversor Bancario",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Código de Verificación</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 0;">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #2980b9, #6dd5fa); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                  Conversor de Resúmenes Bancarios
                </h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                  Tu código de verificación
                </p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 20px;">
                <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                  Hola,<br><br>
                  Usa el siguiente código para completar tu inicio de sesión:
                </p>
                
                <!-- Code Box -->
                <div style="background: linear-gradient(135deg, #2980b9, #6dd5fa); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0; box-shadow: 0 4px 15px rgba(41, 128, 185, 0.3);">
                  <div style="color: white; font-size: 42px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                    ${code}
                  </div>
                </div>
                
                <!-- Instructions -->
                <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #2980b9;">
                  <h3 style="color: #2980b9; margin: 0 0 15px 0; font-size: 18px;">📋 Instrucciones:</h3>
                  <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li>Este código es válido por <strong>10 minutos</strong></li>
                    <li>Ingresa el código en la aplicación para completar tu inicio de sesión</li>
                    <li>Si no solicitaste este código, puedes ignorar este email</li>
                    <li>Por seguridad, nunca compartas este código con nadie</li>
                  </ul>
                </div>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}" 
                     style="background: #2980b9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                    Ir a la Aplicación
                  </a>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background: #f8f9fa; padding: 30px 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 14px; margin: 0 0 10px 0;">
                  Este email fue enviado desde <strong>Conversor de Resúmenes Bancarios</strong>
                </p>
                <p style="color: #999; font-size: 12px; margin: 0;">
                  Si tienes problemas, contacta nuestro soporte o responde a este email.
                </p>
              </div>
              
            </div>
          </body>
          </html>
        `,
        // Versión texto plano como fallback
        text: `
Conversor de Resúmenes Bancarios

Tu código de verificación: ${code}

Este código es válido por 10 minutos.
Ingresa el código en la aplicación para completar tu inicio de sesión.

Si no solicitaste este código, puedes ignorar este email.

Ir a la aplicación: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
        `,
      })

      if (error) {
        console.error("❌ Error enviando email con Resend:", error)
        return { success: false, message: "Error al enviar el código por email. Intenta nuevamente." }
      }

      console.log("✅ Email enviado exitosamente:", data?.id)
      return { success: true, message: `📧 Código enviado a ${email}. Revisa tu bandeja de entrada.` }
    } catch (error) {
      console.error("❌ Error en servicio de email:", error)
      return { success: false, message: "Error al enviar el código de verificación" }
    }
  }

  async sendWelcomeEmail(email: string, name: string, plan: string): Promise<void> {
    try {
      // En desarrollo, si no hay API key de Resend, solo loggear
      if (!resend || !process.env.RESEND_API_KEY) {
        console.log(`📧 [DESARROLLO] Email de bienvenida para ${name} (${email}) - Plan: ${plan}`)
        return
      }

      const planDetails = {
        free: {
          name: "Gratuito",
          pages: "2 páginas por día",
          features: "Conversión básica",
          color: "#6c757d",
          emoji: "🆓",
        },
        pro: {
          name: "Pro",
          pages: "250 páginas por mes",
          features: "Conversión + Edición manual",
          color: "#2980b9",
          emoji: "⭐",
        },
        premium: {
          name: "Premium",
          pages: "400 páginas por mes",
          features: "Conversión + Edición + Chat IA + Múltiples archivos",
          color: "#6dd5fa",
          emoji: "💎",
        },
      }

      const selectedPlan = planDetails[plan as keyof typeof planDetails]

      const { data, error } = await resend.emails.send({
        from: `${EMAIL_CONFIG.fromName} <${EMAIL_CONFIG.from}>`,
        to: [email],
        subject: `🎉 ¡Bienvenido ${name}! Tu cuenta está lista`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>¡Bienvenido!</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white;">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #2980b9, #6dd5fa); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">
                  ¡Bienvenido ${name}! 🎉
                </h1>
                <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 18px;">
                  Tu cuenta ha sido creada exitosamente
                </p>
              </div>
              
              <!-- Plan Info -->
              <div style="padding: 40px 20px;">
                <div style="background: linear-gradient(135deg, ${selectedPlan.color}, ${selectedPlan.color}dd); padding: 30px; border-radius: 12px; color: white; margin: 0 0 30px 0; text-align: center;">
                  <h2 style="margin: 0 0 15px 0; font-size: 28px;">
                    ${selectedPlan.emoji} Plan ${selectedPlan.name}
                  </h2>
                  <p style="margin: 5px 0; font-size: 20px; font-weight: bold;">
                    📄 ${selectedPlan.pages}
                  </p>
                  <p style="margin: 5px 0; font-size: 16px; opacity: 0.9;">
                    ✨ ${selectedPlan.features}
                  </p>
                </div>
                
                <!-- What you can do -->
                <div style="background: #f8f9fa; padding: 30px; border-radius: 12px; margin: 30px 0;">
                  <h3 style="color: #2980b9; margin: 0 0 20px 0; font-size: 22px;">
                    🚀 ¿Qué puedes hacer ahora?
                  </h3>
                  <ul style="color: #666; line-height: 2; margin: 0; padding-left: 20px; font-size: 16px;">
                    <li><strong>📤 Sube</strong> tus resúmenes bancarios en formato PDF</li>
                    <li><strong>🔄 Convierte</strong> automáticamente a Excel editable</li>
                    <li><strong>🏦 Soportamos</strong> todos los bancos argentinos principales</li>
                    ${plan !== "free" ? "<li><strong>✏️ Edita</strong> manualmente las transacciones</li>" : ""}
                    ${plan === "premium" ? "<li><strong>📁 Sube múltiples</strong> archivos y usa el chat con IA</li>" : ""}
                  </ul>
                </div>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 40px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}" 
                     style="background: linear-gradient(135deg, #2980b9, #6dd5fa); color: white; padding: 18px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; font-size: 18px; box-shadow: 0 4px 15px rgba(41, 128, 185, 0.3);">
                    🎯 Comenzar a Convertir
                  </a>
                </div>
                
                <!-- Tips -->
                <div style="border: 2px solid #e3f2fd; background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 30px 0;">
                  <h4 style="color: #2980b9; margin: 0 0 15px 0; font-size: 18px;">
                    💡 Consejos para empezar:
                  </h4>
                  <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li>Los PDFs deben ser resúmenes bancarios originales (no escaneados)</li>
                    <li>Soportamos: Banco Nación, BBVA, Galicia, Santander, ICBC, Macro y más</li>
                    <li>El proceso toma solo unos segundos por archivo</li>
                    ${plan === "free" ? "<li>Puedes actualizar tu plan en cualquier momento</li>" : ""}
                  </ul>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background: #f8f9fa; padding: 30px 20px; text-align: center; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 16px; margin: 0 0 15px 0;">
                  ¿Necesitas ayuda? Estamos aquí para ti 🤝
                </p>
                <p style="color: #999; font-size: 14px; margin: 0;">
                  Responde a este email o contacta nuestro soporte.<br>
                  <strong>Conversor de Resúmenes Bancarios</strong>
                </p>
              </div>
              
            </div>
          </body>
          </html>
        `,
        text: `
¡Bienvenido ${name}!

Tu cuenta ha sido creada exitosamente con el Plan ${selectedPlan.name}.

Plan: ${selectedPlan.name} ${selectedPlan.emoji}
Límite: ${selectedPlan.pages}
Características: ${selectedPlan.features}

¿Qué puedes hacer ahora?
- Sube tus resúmenes bancarios en formato PDF
- Convierte automáticamente a Excel editable
- Soportamos todos los bancos argentinos principales
${plan !== "free" ? "- Edita manualmente las transacciones" : ""}
${plan === "premium" ? "- Sube múltiples archivos y usa el chat con IA" : ""}

Comenzar: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}

¿Necesitas ayuda? Responde a este email.
        `,
      })

      if (error) {
        console.error("❌ Error enviando email de bienvenida:", error)
      } else {
        console.log("✅ Email de bienvenida enviado:", data?.id)
      }
    } catch (error) {
      console.error("❌ Error en email de bienvenida:", error)
    }
  }
}

export const emailService = new EmailService()
