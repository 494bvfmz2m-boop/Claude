<?php
// Stripe REST calls over cURL - no Composer / SDK required

function stripe_mode(): string {
    return setting('stripe_mode', 'test') === 'live' ? 'live' : 'test';
}

function stripe_secret_key(): string {
    return (string) setting(stripe_mode() === 'live' ? 'stripe_live_secret' : 'stripe_test_secret', '');
}

function stripe_enabled(): bool {
    return setting('stripe_enabled', '0') === '1' && stripe_secret_key() !== '';
}

function stripe_request(string $method, string $path, array $params = []) {
    $key = stripe_secret_key();
    if ($key === '') return ['error' => ['message' => 'No Stripe secret key saved.']];

    $url = 'https://api.stripe.com/v1/' . ltrim($path, '/');
    $ch = curl_init();
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $key],
    ];
    if (strtoupper($method) === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = http_build_query($params);
    } elseif ($params) {
        $url .= '?' . http_build_query($params);
    }
    $opts[CURLOPT_URL] = $url;
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    if ($body === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return ['error' => ['message' => 'Connection failed: ' . $err]];
    }
    curl_close($ch);
    $json = json_decode($body, true);
    return is_array($json) ? $json : ['error' => ['message' => 'Unexpected response from Stripe.']];
}

/** Create a Checkout Session for an order. Returns [url, error] */
function stripe_checkout_session(array $order, array $items): array {
    $currency = strtolower(setting('currency', 'aud'));
    $params = [
        'mode'                                 => 'payment',
        'success_url'                          => url('?p=order&ref=' . urlencode($order['reference']) . '&paid=1'),
        'cancel_url'                           => url('?p=order&ref=' . urlencode($order['reference'])),
        'client_reference_id'                  => $order['reference'],
        'metadata[order_id]'                   => $order['id'],
        'metadata[order_reference]'            => $order['reference'],
        'payment_intent_data[metadata][order_reference]' => $order['reference'],
    ];
    if (!empty($order['email'])) $params['customer_email'] = $order['email'];

    $i = 0;
    foreach ($items as $it) {
        $params["line_items[$i][quantity]"] = (int)$it['qty'];
        $params["line_items[$i][price_data][currency]"] = $currency;
        $params["line_items[$i][price_data][unit_amount]"] = (int)$it['unit_price_cents'];
        $params["line_items[$i][price_data][product_data][name]"] = $it['name'];
        $i++;
    }
    if ((int)$order['shipping_cents'] > 0) {
        $params["line_items[$i][quantity]"] = 1;
        $params["line_items[$i][price_data][currency]"] = $currency;
        $params["line_items[$i][price_data][unit_amount]"] = (int)$order['shipping_cents'];
        $params["line_items[$i][price_data][product_data][name]"] = 'Shipping';
    }

    $res = stripe_request('POST', 'checkout/sessions', $params);
    if (isset($res['error'])) return [null, $res['error']['message'] ?? 'Stripe error'];
    q('UPDATE orders SET stripe_session_id = ?, payment_status = ? WHERE id = ?', [$res['id'], 'pending', $order['id']]);
    return [$res['url'], null];
}

function stripe_verify_webhook(string $payload, ?string $sigHeader, string $secret): bool {
    if (!$sigHeader || $secret === '') return false;
    $ts = null; $sigs = [];
    foreach (explode(',', $sigHeader) as $part) {
        $kv = explode('=', trim($part), 2);
        if (count($kv) !== 2) continue;
        if ($kv[0] === 't') $ts = $kv[1];
        if ($kv[0] === 'v1') $sigs[] = $kv[1];
    }
    if (!$ts || !$sigs) return false;
    if (abs(time() - (int)$ts) > 300) return false;
    $expected = hash_hmac('sha256', $ts . '.' . $payload, $secret);
    foreach ($sigs as $s) {
        if (hash_equals($expected, $s)) return true;
    }
    return false;
}
