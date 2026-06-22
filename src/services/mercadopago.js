import { supabase } from './supabase';

/**
 * Crea una preferencia de pago en Mercado Pago llamando a la Edge Function.
 * @param {Object} orderData - Datos del pedido { items, external_reference, back_urls }
 * @returns {Promise<Object>} { init_point, id }
 */
export async function iniciarPagoMercadoPago(orderData) {
  try {
    const { data, error } = await supabase.functions.invoke('create-mp-preference', {
      body: orderData
    });

    if (error) {
      console.error('Error invoking create-mp-preference:', error);
      throw error;
    }

    return data; // Retorna { init_point, id }
  } catch (err) {
    console.error('Error en iniciarPagoMercadoPago:', err);
    throw err;
  }
}

/**
 * Envía un correo electrónico llamando a la Edge Function.
 * @param {Object} emailData - { to, subject, htmlBody }
 */
export async function enviarEmail(emailData) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: emailData
    });

    if (error) {
      console.error('Error invoking send-email:', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error en enviarEmail:', err);
    throw err;
  }
}
