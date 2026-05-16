<?php
/**
 * Professional HTML email bodies (fragments). Plain-text fallbacks included.
 * All public functions return array{html: string, text: string}.
 */

function remquip_email_layout(string $preheader, string $title, string $innerHtml): string
{
    $pre = htmlspecialchars($preheader, ENT_QUOTES, 'UTF-8');
    $tit = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width">'
        . '<title>' . $tit . '</title></head>'
        . '<body style="margin:0;padding:0;background:#0f1419;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
        . '<span style="display:none;font-size:1px;color:#0f1419;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">'
        . $pre . '</span>'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f1419;padding:24px 12px;">'
        . '<tr><td align="center">'
        . '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#1a222c;border-radius:8px;overflow:hidden;border:1px solid #2a3441;">'
        . '<tr><td style="padding:28px 32px;background:linear-gradient(135deg,#1e2630 0%,#141a22 100%);border-bottom:3px solid #e85d04;">'
        . '<p style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.08em;color:#f8fafc;">REMQUIP</p>'
        . '<p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">Heavy-duty truck &amp; trailer parts</p></td></tr>'
        . '<tr><td style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.6;">'
        . '<h1 style="margin:0 0 16px;font-size:22px;color:#f8fafc;font-weight:600;">' . $tit . '</h1>'
        . $innerHtml
        . '</td></tr>'
        . '<tr><td style="padding:20px 32px;background:#141a22;border-top:1px solid #2a3441;font-size:12px;color:#64748b;">'
        . 'This message was sent by REMQUIP. If you did not expect it, you can ignore this email.</td></tr>'
        . '</table></td></tr></table></body></html>';
}

function remquip_tpl_password_reset(array $v): array
{
    $name = htmlspecialchars($v['name'] ?? 'there', ENT_QUOTES, 'UTF-8');
    $link = htmlspecialchars($v['reset_link'] ?? '#', ENT_QUOTES, 'UTF-8');
    $mins = (int)($v['expires_minutes'] ?? 60);
    $inner = '<p style="margin:0 0 16px;">Hi ' . $name . ',</p>'
        . '<p style="margin:0 0 20px;">We received a request to reset your account password. Click the button below to choose a new password. This link expires in <strong>' . $mins . ' minutes</strong>.</p>'
        . '<p style="margin:24px 0;"><a href="' . $link . '" style="display:inline-block;padding:14px 28px;background:#e85d04;color:#0f1419;text-decoration:none;font-weight:700;border-radius:4px;">Reset password</a></p>'
        . '<p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">If the button does not work, copy and paste this URL into your browser:</p>'
        . '<p style="margin:0;word-break:break-all;font-size:12px;color:#cbd5e1;">' . $link . '</p>';
    $html = remquip_email_layout('Reset your REMQUIP password', 'Password reset', $inner);
    $text = "Hi {$v['name']},\n\nReset your password: {$v['reset_link']}\n\nThis link expires in {$mins} minutes.\n\n— REMQUIP";
    return ['html' => $html, 'text' => $text];
}

function remquip_tpl_order_new_admin(array $v): array
{
    $num = htmlspecialchars($v['order_number'] ?? '', ENT_QUOTES, 'UTF-8');
    $total = htmlspecialchars($v['total'] ?? '', ENT_QUOTES, 'UTF-8');
    $oid = htmlspecialchars($v['order_id'] ?? '', ENT_QUOTES, 'UTF-8');
    $inner = '<p style="margin:0 0 16px;">A new order has been placed on the storefront.</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="8" style="width:100%;border-collapse:collapse;font-size:14px;">'
        . '<tr><td style="border-bottom:1px solid #2a3441;color:#94a3b8;">Order #</td><td style="border-bottom:1px solid #2a3441;"><strong>' . $num . '</strong></td></tr>'
        . '<tr><td style="border-bottom:1px solid #2a3441;color:#94a3b8;">Total</td><td style="border-bottom:1px solid #2a3441;">' . $total . '</td></tr>'
        . '<tr><td style="color:#94a3b8;">Order ID</td><td style="font-size:12px;word-break:break-all;">' . $oid . '</td></tr></table>';
    $html = remquip_email_layout('New order ' . $num, 'New order received', $inner);
    $text = "New order\nOrder #: {$v['order_number']}\nTotal: {$v['total']}\nOrder ID: {$v['order_id']}";
    return ['html' => $html, 'text' => $text];
}

function remquip_tpl_order_shipped_customer(array $v): array
{
    $num = htmlspecialchars($v['order_number'] ?? '', ENT_QUOTES, 'UTF-8');
    $carrier = isset($v['carrier']) ? htmlspecialchars((string)$v['carrier'], ENT_QUOTES, 'UTF-8') : '';
    $track = isset($v['tracking']) ? htmlspecialchars((string)$v['tracking'], ENT_QUOTES, 'UTF-8') : '';
    $inner = '<p style="margin:0 0 16px;">Good news — your order <strong>' . $num . '</strong> has shipped.</p>';
    if ($carrier !== '' && $track !== '') {
        $inner .= '<table role="presentation" cellspacing="0" cellpadding="8" style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">'
            . '<tr><td style="border-bottom:1px solid #2a3441;color:#94a3b8;width:120px;">Carrier</td><td style="border-bottom:1px solid #2a3441;">' . $carrier . '</td></tr>'
            . '<tr><td style="color:#94a3b8;">Tracking</td><td><strong>' . $track . '</strong></td></tr></table>';
    } elseif ($track !== '') {
        $inner .= '<p style="margin:12px 0 0;">Tracking: <strong>' . $track . '</strong></p>';
    }
    $inner .= '<p style="margin:24px 0 0;font-size:14px;">Thank you for choosing REMQUIP.</p>';
    $html = remquip_email_layout('Your order ' . $num . ' has shipped', 'Your order has shipped', $inner);
    $t = "Order {$v['order_number']} has shipped.\n";
    if (!empty($v['carrier']) && !empty($v['tracking'])) {
        $t .= "Carrier: {$v['carrier']}\nTracking: {$v['tracking']}\n";
    }
    $t .= "\n— REMQUIP";
    return ['html' => $html, 'text' => $t];
}

function remquip_tpl_new_customer_admin(array $v): array
{
    $company = htmlspecialchars($v['company'] ?? '', ENT_QUOTES, 'UTF-8');
    $email = htmlspecialchars($v['email'] ?? '', ENT_QUOTES, 'UTF-8');
    $inner = '<p style="margin:0 0 16px;">A new customer record was created from the storefront or admin.</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="8" style="width:100%;border-collapse:collapse;">'
        . '<tr><td style="color:#94a3b8;width:100px;">Company</td><td><strong>' . $company . '</strong></td></tr>'
        . '<tr><td style="color:#94a3b8;">Email</td><td>' . $email . '</td></tr></table>';
    $html = remquip_email_layout('New customer ' . $email, 'New customer', $inner);
    $text = "New customer\nCompany: {$v['company']}\nEmail: {$v['email']}";
    return ['html' => $html, 'text' => $text];
}

function remquip_tpl_low_stock_admin(array $v): array
{
    $sku = htmlspecialchars($v['sku'] ?? '', ENT_QUOTES, 'UTF-8');
    $name = htmlspecialchars($v['name'] ?? '', ENT_QUOTES, 'UTF-8');
    $avail = htmlspecialchars((string)($v['available'] ?? ''), ENT_QUOTES, 'UTF-8');
    $reorder = htmlspecialchars((string)($v['reorder'] ?? ''), ENT_QUOTES, 'UTF-8');
    $inner = '<p style="margin:0 0 16px;">Inventory has fallen at or below the reorder level.</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="8" style="width:100%;border-collapse:collapse;font-size:14px;">'
        . '<tr><td style="color:#94a3b8;">SKU</td><td><strong>' . $sku . '</strong></td></tr>'
        . '<tr><td style="color:#94a3b8;">Product</td><td>' . $name . '</td></tr>'
        . '<tr><td style="color:#94a3b8;">Available</td><td>' . $avail . '</td></tr>'
        . '<tr><td style="color:#94a3b8;">Reorder level</td><td>' . $reorder . '</td></tr></table>';
    $html = remquip_email_layout('Low stock: ' . $sku, 'Low stock alert', $inner);
    $text = "Low stock\nSKU: {$v['sku']}\nProduct: {$v['name']}\nAvailable: {$v['available']}\nReorder: {$v['reorder']}";
    return ['html' => $html, 'text' => $text];
}

function remquip_tpl_order_status_customer(array $v): array
{
    $num = htmlspecialchars($v['order_number'] ?? '', ENT_QUOTES, 'UTF-8');
    $status = htmlspecialchars($v['status'] ?? '', ENT_QUOTES, 'UTF-8');
    $inner = '<p style="margin:0 0 16px;">Your order <strong>' . $num . '</strong> status is now: <strong style="color:#e85d04;">' . $status . '</strong>.</p>'
        . '<p style="margin:0;font-size:14px;">You can sign in to your account or contact us if you have questions.</p>';
    $html = remquip_email_layout('Order ' . $num . ' — ' . $status, 'Order status update', $inner);
    $text = "Order {$v['order_number']} status is now: {$v['status']}.\n\n— REMQUIP";
    return ['html' => $html, 'text' => $text];
}

function remquip_tpl_order_paid_customer(array $v): array
{
    $num = htmlspecialchars($v['order_number'] ?? '', ENT_QUOTES, 'UTF-8');
    $total = htmlspecialchars($v['total'] ?? '', ENT_QUOTES, 'UTF-8');
    
    $inner = '<p style="margin:0 0 16px;">Great news! We have successfully received your payment for order <strong>' . $num . '</strong>.</p>'
        . '<p style="margin:0 0 16px;">We are now preparing your order for shipment. You will receive another email with tracking information once it leaves our warehouse.</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="8" style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;margin-bottom:24px;">'
        . '<tr><td style="border-bottom:1px solid #2a3441;color:#94a3b8;width:120px;">Order #</td><td style="border-bottom:1px solid #2a3441;"><strong>' . $num . '</strong></td></tr>'
        . '<tr><td style="color:#94a3b8;">Total Paid</td><td><strong>' . $total . '</strong></td></tr></table>'
        . '<p style="margin:24px 0 0;font-size:14px;">Thank you for shopping with REMQUIP.</p>';
        
    $html = remquip_email_layout('Payment confirmed for order ' . $num, 'Payment Successful', $inner);
    $text = "Payment confirmed for order {$num}.\nTotal Paid: {$total}\n\nWe are now preparing your order for shipment.\n\n— REMQUIP";

    return ['html' => $html, 'text' => $text];
}

function remquip_tpl_welcome_customer(array $v): array
{
    $name     = htmlspecialchars($v['name']     ?? 'there',       ENT_QUOTES, 'UTF-8');
    $email    = htmlspecialchars($v['email']    ?? '',             ENT_QUOTES, 'UTF-8');
    $password = htmlspecialchars($v['password'] ?? '',             ENT_QUOTES, 'UTF-8');
    $loginUrl = htmlspecialchars($v['login_url'] ?? '#',           ENT_QUOTES, 'UTF-8');
    $company  = htmlspecialchars($v['company']  ?? '',             ENT_QUOTES, 'UTF-8');

    $inner = '<p style="margin:0 0 16px;">Hi ' . $name . ',</p>'
        . '<p style="margin:0 0 20px;">Your REMQUIP customer account has been created'
        . ($company !== '' ? ' for <strong>' . $company . '</strong>' : '')
        . '. You can now sign in to track orders, view invoices, and manage your account.</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="10" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;background:#141a22;border-radius:6px;">'
        . '<tr><td style="color:#94a3b8;width:120px;">Email</td><td><strong style="color:#f8fafc;">' . $email . '</strong></td></tr>'
        . '<tr><td style="color:#94a3b8;">Password</td><td><strong style="color:#e85d04;font-family:monospace;font-size:15px;">' . $password . '</strong></td></tr>'
        . '</table>'
        . '<p style="margin:0 0 24px;font-size:13px;color:#94a3b8;">We strongly recommend changing your password after your first login.</p>'
        . '<p style="margin:24px 0;"><a href="' . $loginUrl . '" style="display:inline-block;padding:14px 28px;background:#e85d04;color:#0f1419;text-decoration:none;font-weight:700;border-radius:4px;">Sign in to your account</a></p>'
        . '<p style="margin:0;font-size:13px;color:#94a3b8;">If you have any questions, reply to this email or contact our support team.</p>';

    $html = remquip_email_layout('Welcome to REMQUIP', 'Welcome to REMQUIP', $inner);
    $text = "Hi {$v['name']},\n\nYour REMQUIP account has been created.\n\nEmail: {$v['email']}\nPassword: {$v['password']}\n\nSign in at: {$v['login_url']}\n\nPlease change your password after first login.\n\n— REMQUIP";
    return ['html' => $html, 'text' => $text];
}

// =====================================================================
// ACCOUNT APPLICATION EMAIL TEMPLATES
// =====================================================================

function remquip_tpl_application_received(array $v): array
{
    $name    = htmlspecialchars($v['name'] ?? 'there', ENT_QUOTES, 'UTF-8');
    $company = htmlspecialchars($v['company'] ?? '', ENT_QUOTES, 'UTF-8');
    $inner = '<p style="margin:0 0 16px;">Hi ' . $name . ',</p>'
        . '<p style="margin:0 0 20px;">Thank you for submitting your account application'
        . ($company !== '' ? ' for <strong>' . $company . '</strong>' : '') . '.</p>'
        . '<p style="margin:0 0 16px;">Our team will review your application and get back to you shortly. You will receive another email once your application has been processed.</p>'
        . '<p style="margin:24px 0 0;font-size:14px;">Thank you for choosing REMQUIP.</p>';
    $html = remquip_email_layout('Application received', 'Application Received', $inner);
    $text = "Hi {$v['name']},\n\nThank you for submitting your account application"
        . (!empty($v['company']) ? " for {$v['company']}" : '') . ".\n\nOur team will review it and get back to you shortly.\n\n— REMQUIP";
    return ['html' => $html, 'text' => $text];
}

function remquip_tpl_application_approved(array $v): array
{
    $name     = htmlspecialchars($v['name'] ?? 'there', ENT_QUOTES, 'UTF-8');
    $company  = htmlspecialchars($v['company'] ?? '', ENT_QUOTES, 'UTF-8');
    $loginUrl = htmlspecialchars($v['login_url'] ?? '#', ENT_QUOTES, 'UTF-8');
    $inner = '<p style="margin:0 0 16px;">Hi ' . $name . ',</p>'
        . '<p style="margin:0 0 20px;">Great news! Your account application'
        . ($company !== '' ? ' for <strong>' . $company . '</strong>' : '')
        . ' has been <strong style="color:#22c55e;">approved</strong>.</p>'
        . '<p style="margin:0 0 16px;">Your customer account is now active. You can sign in to your portal to place orders, view invoices, and manage your account.</p>'
        . '<p style="margin:24px 0;"><a href="' . $loginUrl . '" style="display:inline-block;padding:14px 28px;background:#e85d04;color:#0f1419;text-decoration:none;font-weight:700;border-radius:4px;">Access Your Account</a></p>'
        . '<p style="margin:0;font-size:13px;color:#94a3b8;">If you have any questions, reply to this email or contact our sales team.</p>';
    $html = remquip_email_layout('Account approved', 'Account Application Approved', $inner);
    $text = "Hi {$v['name']},\n\nYour account application has been approved!\n\nSign in at: {$v['login_url']}\n\n— REMQUIP";
    return ['html' => $html, 'text' => $text];
}

// =====================================================================
// OFFER / QUOTE EMAIL TEMPLATES
// =====================================================================

/**
 * Send a quote/offer to the customer.
 * $v keys: offer_number, customer_name, valid_until, total, items (array of name+qty+price),
 *          custom_message (optional personalised note from admin), subtotal, discount, shipping, tax
 */
function remquip_tpl_offer_sent_customer(array $v): array
{
    $name    = htmlspecialchars($v['customer_name'] ?? 'Valued Customer', ENT_QUOTES, 'UTF-8');
    $num     = htmlspecialchars($v['offer_number']  ?? '',                ENT_QUOTES, 'UTF-8');
    $valid   = !empty($v['valid_until']) ? htmlspecialchars($v['valid_until'], ENT_QUOTES, 'UTF-8') : null;
    $total   = htmlspecialchars(number_format((float)($v['total'] ?? 0), 2), ENT_QUOTES, 'UTF-8');
    $sub     = number_format((float)($v['subtotal']  ?? 0), 2);
    $disc    = number_format((float)($v['discount']  ?? 0), 2);
    $ship    = number_format((float)($v['shipping']  ?? 0), 2);
    $tax     = number_format((float)($v['tax']       ?? 0), 2);
    $custom  = !empty($v['custom_message'])
        ? '<div style="margin:0 0 24px;padding:16px 20px;background:#141a22;border-left:3px solid #e85d04;border-radius:0 6px 6px 0;">'
          . '<p style="margin:0;font-size:14px;color:#e2e8f0;white-space:pre-wrap;">'
          . htmlspecialchars($v['custom_message'], ENT_QUOTES, 'UTF-8') . '</p></div>'
        : '';

    // Line items table
    $rows = '';
    if (!empty($v['items']) && is_array($v['items'])) {
        foreach ($v['items'] as $item) {
            $iname  = htmlspecialchars($item['name'] ?? 'Item',               ENT_QUOTES, 'UTF-8');
            $isku   = !empty($item['sku']) ? '<div style="font-size:11px;color:#64748b;">' . htmlspecialchars($item['sku'], ENT_QUOTES, 'UTF-8') . '</div>' : '';
            $iqty   = (int)($item['quantity']   ?? 1);
            $iup    = number_format((float)($item['unit_price'] ?? 0), 2);
            $ilt    = number_format((float)($item['line_total'] ?? ($item['quantity'] * $item['unit_price'] ?? 0)), 2);
            $rows  .= '<tr>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;">' . $iname . $isku . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:center;">' . $iqty . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:right;">$' . $iup . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:right;font-weight:600;">$' . $ilt . '</td>'
                . '</tr>';
        }
    }

    $totalsRows = '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Subtotal</td><td style="padding:6px 8px;text-align:right;">$' . $sub . '</td></tr>';
    if ((float)$disc > 0) {
        $totalsRows .= '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Discount</td><td style="padding:6px 8px;text-align:right;color:#22c55e;">-$' . $disc . '</td></tr>';
    }
    if ((float)$ship > 0) {
        $totalsRows .= '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Shipping</td><td style="padding:6px 8px;text-align:right;">$' . $ship . '</td></tr>';
    }
    if ((float)$tax > 0) {
        $totalsRows .= '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Tax</td><td style="padding:6px 8px;text-align:right;">$' . $tax . '</td></tr>';
    }
    $totalsRows .= '<tr><td colspan="3" style="padding:10px 8px;text-align:right;font-weight:700;font-size:15px;border-top:2px solid #2a3441;">TOTAL</td>'
        . '<td style="padding:10px 8px;text-align:right;font-weight:700;font-size:15px;color:#e85d04;border-top:2px solid #2a3441;">$' . $total . '</td></tr>';

    $inner = '<p style="margin:0 0 16px;">Dear ' . $name . ',</p>'
        . '<p style="margin:0 0 20px;">Please find attached your quote <strong style="color:#e85d04;">' . $num . '</strong>'
        . ($valid ? ', valid until <strong>' . $valid . '</strong>' : '') . '.</p>'
        . $custom
        . ($rows !== '' ? '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">'
            . '<thead><tr style="background:#141a22;">'
            . '<th style="padding:10px 8px;text-align:left;color:#94a3b8;font-weight:600;">Item</th>'
            . '<th style="padding:10px 8px;text-align:center;color:#94a3b8;font-weight:600;width:50px;">Qty</th>'
            . '<th style="padding:10px 8px;text-align:right;color:#94a3b8;font-weight:600;width:90px;">Unit</th>'
            . '<th style="padding:10px 8px;text-align:right;color:#94a3b8;font-weight:600;width:90px;">Total</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody><tfoot>' . $totalsRows . '</tfoot></table>' : '')
        . '<p style="margin:24px 0 8px;font-size:14px;">To accept this quote or if you have any questions, please reply to this email or contact our sales team.</p>'
        . '<p style="margin:0;font-size:13px;color:#94a3b8;">Thank you for choosing REMQUIP.</p>';

    $html = remquip_email_layout('Quote ' . $num . ' from REMQUIP', 'Your Quote from REMQUIP', $inner);
    $text = "Dear {$v['customer_name']},\n\nPlease find your quote {$num}"
        . ($valid ? " (valid until {$valid})" : '') . " for a total of \${$total}.\n\n"
        . (!empty($v['custom_message']) ? $v['custom_message'] . "\n\n" : '')
        . "To accept or if you have questions, reply to this email.\n\n— REMQUIP";
    return ['html' => $html, 'text' => $text];
}

/**
 * Notify customer their accepted quote has been converted to an order.
 * $v keys: customer_name, offer_number, order_number, total
 */
function remquip_tpl_order_from_offer_customer(array $v): array
{
    $name   = htmlspecialchars($v['customer_name'] ?? 'Valued Customer', ENT_QUOTES, 'UTF-8');
    $ofnum  = htmlspecialchars($v['offer_number']  ?? '',                ENT_QUOTES, 'UTF-8');
    $ornum  = htmlspecialchars($v['order_number']  ?? '',                ENT_QUOTES, 'UTF-8');
    $total  = htmlspecialchars(number_format((float)($v['total'] ?? 0), 2), ENT_QUOTES, 'UTF-8');

    $inner = '<p style="margin:0 0 16px;">Dear ' . $name . ',</p>'
        . '<p style="margin:0 0 20px;">Great news! Your accepted quote <strong style="color:#e85d04;">' . $ofnum . '</strong> has been confirmed and an order has been created.</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="10" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;background:#141a22;border-radius:6px;">'
        . '<tr><td style="color:#94a3b8;width:120px;">Quote #</td><td>' . $ofnum . '</td></tr>'
        . '<tr><td style="color:#94a3b8;">Order #</td><td><strong style="color:#f8fafc;">' . $ornum . '</strong></td></tr>'
        . '<tr><td style="color:#94a3b8;">Total</td><td><strong style="color:#e85d04;">$' . $total . '</strong></td></tr>'
        . '</table>'
        . '<p style="margin:0 0 16px;font-size:14px;">Our team will be in touch with you shortly to confirm the next steps for your order.</p>'
        . '<p style="margin:0;font-size:13px;color:#94a3b8;">Thank you for your business with REMQUIP.</p>';

    $html = remquip_email_layout('Order ' . $ornum . ' confirmed — REMQUIP', 'Your Order is Confirmed', $inner);
    $text = "Dear {$v['customer_name']},\n\nYour quote {$ofnum} has been converted to order {$ornum} for a total of \${$total}.\n\nWe will be in touch shortly.\n\n— REMQUIP";
    return ['html' => $html, 'text' => $text];
}

function remquip_tpl_application_admin_notification(array $v): array
{
    $company = htmlspecialchars($v['company'] ?? '', ENT_QUOTES, 'UTF-8');
    $contact = htmlspecialchars($v['contact'] ?? '', ENT_QUOTES, 'UTF-8');
    $email   = htmlspecialchars($v['email'] ?? '', ENT_QUOTES, 'UTF-8');
    $phone   = htmlspecialchars($v['phone'] ?? '', ENT_QUOTES, 'UTF-8');
    $inner = '<p style="margin:0 0 16px;">A new customer account application has been submitted and is awaiting your review.</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="8" style="width:100%;border-collapse:collapse;font-size:14px;">'
        . '<tr><td style="border-bottom:1px solid #2a3441;color:#94a3b8;width:120px;">Company</td><td style="border-bottom:1px solid #2a3441;"><strong>' . $company . '</strong></td></tr>'
        . '<tr><td style="border-bottom:1px solid #2a3441;color:#94a3b8;">Contact</td><td style="border-bottom:1px solid #2a3441;">' . $contact . '</td></tr>'
        . '<tr><td style="border-bottom:1px solid #2a3441;color:#94a3b8;">Email</td><td style="border-bottom:1px solid #2a3441;">' . $email . '</td></tr>'
        . ($phone !== '' ? '<tr><td style="color:#94a3b8;">Phone</td><td>' . $phone . '</td></tr>' : '')
        . '</table>'
        . '<p style="margin:24px 0 0;font-size:14px;">Log in to the admin dashboard to review and approve or reject this application.</p>';
    $html = remquip_email_layout('New account application: ' . $company, 'New Account Application', $inner);
    $text = "New account application\nCompany: {$v['company']}\nContact: {$v['contact']}\nEmail: {$v['email']}\nPhone: {$v['phone']}\n\nReview in admin dashboard.";
    return ['html' => $html, 'text' => $text];
}

/**
 * Invoice sent to customer email template.
 * $v keys: customer_name, invoice_number, issue_date, due_date,
 *          items, subtotal, discount, shipping, tax, total, custom_message
 */
function remquip_tpl_invoice_sent_customer(array $v): array
{
    $name    = htmlspecialchars($v['customer_name'] ?? 'Valued Customer', ENT_QUOTES, 'UTF-8');
    $num     = htmlspecialchars($v['invoice_number'] ?? '',               ENT_QUOTES, 'UTF-8');
    $issued  = !empty($v['issue_date']) ? htmlspecialchars($v['issue_date'], ENT_QUOTES, 'UTF-8') : null;
    $due     = !empty($v['due_date'])   ? htmlspecialchars($v['due_date'],   ENT_QUOTES, 'UTF-8') : null;
    $total   = htmlspecialchars(number_format((float)($v['total'] ?? 0), 2), ENT_QUOTES, 'UTF-8');
    $sub     = number_format((float)($v['subtotal']  ?? 0), 2);
    $disc    = number_format((float)($v['discount']  ?? 0), 2);
    $ship    = number_format((float)($v['shipping']  ?? 0), 2);
    $tax     = number_format((float)($v['tax']       ?? 0), 2);
    $balance = number_format((float)($v['balance_due'] ?? $v['total'] ?? 0), 2);
    $custom  = !empty($v['custom_message'])
        ? '<div style="margin:0 0 24px;padding:16px 20px;background:#141a22;border-left:3px solid #e85d04;border-radius:0 6px 6px 0;">'
          . '<p style="margin:0;font-size:14px;color:#e2e8f0;white-space:pre-wrap;">'
          . htmlspecialchars($v['custom_message'], ENT_QUOTES, 'UTF-8') . '</p></div>'
        : '';

    // Line items table
    $rows = '';
    if (!empty($v['items']) && is_array($v['items'])) {
        foreach ($v['items'] as $item) {
            $iname  = htmlspecialchars($item['name'] ?? $item['product_name'] ?? 'Item', ENT_QUOTES, 'UTF-8');
            $isku   = !empty($item['sku']) ? '<div style="font-size:11px;color:#64748b;">' . htmlspecialchars($item['sku'], ENT_QUOTES, 'UTF-8') . '</div>' : '';
            $iqty   = (int)($item['quantity']   ?? 1);
            $iup    = number_format((float)($item['unit_price'] ?? 0), 2);
            $ilt    = number_format((float)($item['line_total'] ?? ($item['quantity'] * $item['unit_price'] ?? 0)), 2);
            $rows  .= '<tr>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;">' . $iname . $isku . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:center;">' . $iqty . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:right;">$' . $iup . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:right;font-weight:600;">$' . $ilt . '</td>'
                . '</tr>';
        }
    }

    $totalsRows = '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Subtotal</td><td style="padding:6px 8px;text-align:right;">$' . $sub . '</td></tr>';
    if ((float)$disc > 0) {
        $totalsRows .= '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Discount</td><td style="padding:6px 8px;text-align:right;color:#22c55e;">-$' . $disc . '</td></tr>';
    }
    if ((float)$ship > 0) {
        $totalsRows .= '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Shipping</td><td style="padding:6px 8px;text-align:right;">$' . $ship . '</td></tr>';
    }
    if ((float)$tax > 0) {
        $totalsRows .= '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Tax</td><td style="padding:6px 8px;text-align:right;">$' . $tax . '</td></tr>';
    }
    $totalsRows .= '<tr><td colspan="3" style="padding:10px 8px;text-align:right;font-weight:700;font-size:15px;border-top:2px solid #2a3441;">TOTAL</td>'
        . '<td style="padding:10px 8px;text-align:right;font-weight:700;font-size:15px;color:#e85d04;border-top:2px solid #2a3441;">$' . $total . '</td></tr>';

    $dateInfo = '';
    if ($issued) $dateInfo .= '<tr><td style="color:#94a3b8;width:120px;">Issue Date</td><td>' . $issued . '</td></tr>';
    if ($due)    $dateInfo .= '<tr><td style="color:#94a3b8;">Due Date</td><td><strong style="color:#f8fafc;">' . $due . '</strong></td></tr>';
    $dateInfo .= '<tr><td style="color:#94a3b8;">Balance Due</td><td><strong style="color:#e85d04;">$' . $balance . '</strong></td></tr>';

    $inner = '<p style="margin:0 0 16px;">Dear ' . $name . ',</p>'
        . '<p style="margin:0 0 20px;">Please find your invoice <strong style="color:#e85d04;">' . $num . '</strong>'
        . ($due ? ', due by <strong>' . $due . '</strong>' : '') . '.</p>'
        . $custom
        . '<table role="presentation" cellspacing="0" cellpadding="10" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;background:#141a22;border-radius:6px;">'
        . $dateInfo . '</table>'
        . ($rows !== '' ? '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">'
            . '<thead><tr style="background:#141a22;">'
            . '<th style="padding:10px 8px;text-align:left;color:#94a3b8;font-weight:600;">Item</th>'
            . '<th style="padding:10px 8px;text-align:center;color:#94a3b8;font-weight:600;width:50px;">Qty</th>'
            . '<th style="padding:10px 8px;text-align:right;color:#94a3b8;font-weight:600;width:90px;">Unit</th>'
            . '<th style="padding:10px 8px;text-align:right;color:#94a3b8;font-weight:600;width:90px;">Total</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody><tfoot>' . $totalsRows . '</tfoot></table>' : '')
        . '<p style="margin:24px 0 8px;font-size:14px;">For payment details or questions, please reply to this email or contact our team.</p>'
        . '<p style="margin:0;font-size:13px;color:#94a3b8;">Thank you for your business with REMQUIP.</p>';

    $html = remquip_email_layout('Invoice ' . $num . ' from REMQUIP', 'Your Invoice from REMQUIP', $inner);
    $text = "Dear {$v['customer_name']},\n\nPlease find your invoice {$num}"
        . ($due ? " (due by {$due})" : '') . " for a total of \${$total}.\n\n"
        . (!empty($v['custom_message']) ? $v['custom_message'] . "\n\n" : '')
        . "For payment details or questions, reply to this email.\n\n— REMQUIP";
    return ['html' => $html, 'text' => $text];
}

// =====================================================================
// ORDER CONFIRMATION EMAIL (sent to customer on order submission)
// =====================================================================

/**
 * Order confirmation email sent to the customer immediately after placing an order.
 * Works for all payment methods: Stripe, cash, check, bank, contract.
 *
 * $v keys: customer_name, order_number, order_id, payment_method,
 *          items (array of name+quantity+unit_price+line_total),
 *          subtotal, tax, shipping, total
 */
function remquip_tpl_order_confirmation_customer(array $v): array
{
    $name    = htmlspecialchars($v['customer_name'] ?? 'Valued Customer', ENT_QUOTES, 'UTF-8');
    $num     = htmlspecialchars($v['order_number']  ?? '',                ENT_QUOTES, 'UTF-8');
    $total   = htmlspecialchars(number_format((float)($v['total'] ?? 0), 2), ENT_QUOTES, 'UTF-8');
    $sub     = number_format((float)($v['subtotal']  ?? 0), 2);
    $ship    = number_format((float)($v['shipping']  ?? 0), 2);
    $tax     = number_format((float)($v['tax']       ?? 0), 2);
    $method  = strtolower(trim($v['payment_method'] ?? 'stripe'));

    // Payment method display name & instructions
    $methodLabels = [
        'stripe'   => 'Credit Card (Stripe)',
        'cash'     => 'Cash on Delivery',
        'check'    => 'Check on Delivery',
        'bank'     => 'Bank Transfer',
        'contract' => 'Pay by Contract',
    ];
    $methodLabel = htmlspecialchars($methodLabels[$method] ?? ucfirst($method), ENT_QUOTES, 'UTF-8');

    $paymentNote = '';
    if ($method === 'cash') {
        $paymentNote = '<div style="margin:16px 0 24px;padding:16px 20px;background:#141a22;border-left:3px solid #e85d04;border-radius:0 6px 6px 0;">'
            . '<p style="margin:0;font-size:14px;color:#e2e8f0;"><strong>💵 Cash on Delivery:</strong> Please have the exact amount ready when the driver arrives. Payment is due upon delivery.</p></div>';
    } elseif ($method === 'check') {
        $paymentNote = '<div style="margin:16px 0 24px;padding:16px 20px;background:#141a22;border-left:3px solid #e85d04;border-radius:0 6px 6px 0;">'
            . '<p style="margin:0;font-size:14px;color:#e2e8f0;"><strong>📝 Check on Delivery:</strong> Please have a check made out to <strong>REMQUIP</strong> for <strong>$' . $total . '</strong> ready when the driver arrives.</p></div>';
    } elseif ($method === 'bank') {
        $paymentNote = '<div style="margin:16px 0 24px;padding:16px 20px;background:#141a22;border-left:3px solid #e85d04;border-radius:0 6px 6px 0;">'
            . '<p style="margin:0;font-size:14px;color:#e2e8f0;"><strong>🏦 Bank Transfer:</strong> Please complete the wire transfer at your earliest convenience. Your order will be processed once payment is received.</p></div>';
    } elseif ($method === 'contract') {
        $paymentNote = '<div style="margin:16px 0 24px;padding:16px 20px;background:#141a22;border-left:3px solid #e85d04;border-radius:0 6px 6px 0;">'
            . '<p style="margin:0;font-size:14px;color:#e2e8f0;"><strong>📋 Contract:</strong> This order will be invoiced per your contract terms. No payment is required now.</p></div>';
    } elseif ($method === 'stripe') {
        $paymentNote = '<div style="margin:16px 0 24px;padding:16px 20px;background:#141a22;border-left:3px solid #22c55e;border-radius:0 6px 6px 0;">'
            . '<p style="margin:0;font-size:14px;color:#e2e8f0;"><strong>✅ Payment received:</strong> Your credit card payment has been processed successfully.</p></div>';
    }

    // Line items table
    $rows = '';
    if (!empty($v['items']) && is_array($v['items'])) {
        foreach ($v['items'] as $item) {
            $iname = htmlspecialchars($item['name'] ?? $item['product_name'] ?? 'Item', ENT_QUOTES, 'UTF-8');
            $isku  = !empty($item['sku']) ? '<div style="font-size:11px;color:#64748b;">' . htmlspecialchars($item['sku'], ENT_QUOTES, 'UTF-8') . '</div>' : '';
            $iqty  = (int)($item['quantity'] ?? 1);
            $iup   = number_format((float)($item['unit_price'] ?? 0), 2);
            $ilt   = number_format((float)($item['line_total'] ?? ($iqty * (float)($item['unit_price'] ?? 0))), 2);
            $rows .= '<tr>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;">' . $iname . $isku . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:center;">' . $iqty . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:right;">$' . $iup . '</td>'
                . '<td style="padding:10px 8px;border-bottom:1px solid #2a3441;text-align:right;font-weight:600;">$' . $ilt . '</td>'
                . '</tr>';
        }
    }

    $totalsRows = '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Subtotal</td><td style="padding:6px 8px;text-align:right;">$' . $sub . '</td></tr>';
    if ((float)$ship > 0) {
        $totalsRows .= '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Shipping</td><td style="padding:6px 8px;text-align:right;">$' . $ship . '</td></tr>';
    }
    if ((float)$tax > 0) {
        $totalsRows .= '<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#94a3b8;font-size:13px;">Tax</td><td style="padding:6px 8px;text-align:right;">$' . $tax . '</td></tr>';
    }
    $totalsRows .= '<tr><td colspan="3" style="padding:10px 8px;text-align:right;font-weight:700;font-size:15px;border-top:2px solid #2a3441;">TOTAL</td>'
        . '<td style="padding:10px 8px;text-align:right;font-weight:700;font-size:15px;color:#e85d04;border-top:2px solid #2a3441;">$' . $total . '</td></tr>';

    $inner = '<p style="margin:0 0 16px;">Dear ' . $name . ',</p>'
        . '<p style="margin:0 0 6px;">Thank you for your order! Your order <strong style="color:#e85d04;">#' . $num . '</strong> has been received and is being processed.</p>'
        . '<table role="presentation" cellspacing="0" cellpadding="10" style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0;background:#141a22;border-radius:6px;">'
        . '<tr><td style="color:#94a3b8;width:140px;">Order Number</td><td><strong style="color:#f8fafc;">#' . $num . '</strong></td></tr>'
        . '<tr><td style="color:#94a3b8;">Payment Method</td><td>' . $methodLabel . '</td></tr>'
        . '<tr><td style="color:#94a3b8;">Order Total</td><td><strong style="color:#e85d04;">$' . $total . '</strong></td></tr>'
        . '</table>'
        . $paymentNote
        . ($rows !== '' ? '<h2 style="margin:24px 0 12px;font-size:16px;color:#f8fafc;">Order Details</h2>'
            . '<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">'
            . '<thead><tr style="background:#141a22;">'
            . '<th style="padding:10px 8px;text-align:left;color:#94a3b8;font-weight:600;">Item</th>'
            . '<th style="padding:10px 8px;text-align:center;color:#94a3b8;font-weight:600;width:50px;">Qty</th>'
            . '<th style="padding:10px 8px;text-align:right;color:#94a3b8;font-weight:600;width:90px;">Unit</th>'
            . '<th style="padding:10px 8px;text-align:right;color:#94a3b8;font-weight:600;width:90px;">Total</th>'
            . '</tr></thead><tbody>' . $rows . '</tbody><tfoot>' . $totalsRows . '</tfoot></table>' : '')
        . '<p style="margin:24px 0 8px;font-size:14px;">You will receive another email when your order ships with tracking information.</p>'
        . '<p style="margin:0;font-size:13px;color:#94a3b8;">If you have any questions, reply to this email or contact our team. Thank you for choosing REMQUIP.</p>';

    $html = remquip_email_layout('Order #' . $num . ' confirmed — REMQUIP', 'Order Confirmation', $inner);

    $methodTextMap = [
        'cash'     => 'Cash on Delivery — please have the exact amount ready.',
        'check'    => 'Check on Delivery — please have a check made out to REMQUIP.',
        'bank'     => 'Bank Transfer — please complete the wire transfer.',
        'contract' => 'Pay by Contract — invoiced per your contract terms.',
        'stripe'   => 'Credit card payment received.',
    ];
    $methodText = $methodTextMap[$method] ?? ucfirst($method);

    $text = "Dear {$v['customer_name']},\n\nThank you for your order!\n\n"
        . "Order #: {$v['order_number']}\n"
        . "Payment: {$methodText}\n"
        . "Total: \${$total}\n\n"
        . "You will receive another email when your order ships.\n\n— REMQUIP";

    return ['html' => $html, 'text' => $text];
}
