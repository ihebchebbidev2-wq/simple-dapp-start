<?php
/**
 * Minimal SMTP client for OVH (SSL:465 or STARTTLS:587). No Composer dependency.
 */
final class RemquipSmtp
{
    /** @var resource|null */
    private $socket;

    /** Last SMTP-level error message from the most recent send() call. */
    public static string $lastError = '';

    /**
     * @return bool
     */
    public static function isConfigured(): bool
    {
        $u = trim((string)(defined('SMTP_USER') ? SMTP_USER : ''));
        $p = (string)(defined('SMTP_PASS') ? SMTP_PASS : '');
        if ($u === '' || $p === '') {
            return false;
        }
        return true;
    }

    /**
     * @param string $from RFC5322 From (e.g. "REMQUIP <noreply@domain.com>" or email only)
     * @param string $to Recipient email
     * @param string $subject UTF-8 subject
     * @param string $htmlBody HTML fragment or full document
     * @param string|null $plainBody Optional plain text (multipart/alternative)
     * @param string $html HTML fragment or full document
     * @param string|null $plain Optional plain text (multipart/alternative)
     * @param string|null $replyTo Optional Reply-To address
     * @param array|null $config Optional array of configuration settings (host, port, encryption, user, pass)
     */
    public static function send(
        string $from,
        string $to,
        string $subject,
        string $html,
        ?string $plain = null,
        ?string $replyTo = null,
        ?array $config = null
    ): bool {
        // Check if configuration is provided via $config or global constants
        $host = isset($config['host']) ? $config['host'] : (defined('SMTP_HOST') ? SMTP_HOST : '');
        $port = (int)(isset($config['port']) ? $config['port'] : (defined('SMTP_PORT') ? SMTP_PORT : 465));
        $encryption = isset($config['encryption']) ? $config['encryption'] : (defined('SMTP_ENCRYPTION') ? SMTP_ENCRYPTION : 'ssl');
        $user = isset($config['user']) ? $config['user'] : (defined('SMTP_USER') ? SMTP_USER : '');
        $pass = isset($config['pass']) ? $config['pass'] : (defined('SMTP_PASS') ? SMTP_PASS : '');

        self::$lastError = '';

        // If user/pass are still empty, and no config was provided, check global config
        if (($user === '' || $pass === '') && $config === null) {
            if (!self::isConfigured()) {
                self::$lastError = 'SMTP not configured (user/pass empty)';
                Logger::warning('RemquipSmtp: not configured', []);
                return false;
            }
        } elseif ($user === '' || $pass === '') {
            self::$lastError = 'SMTP user or pass not provided in config';
            Logger::warning('RemquipSmtp: user or pass not provided in config', []);
            return false;
        }

        $enc = strtolower($encryption);

        $smtp = new self();
        try {
            if ($enc === 'ssl') {
                $smtp->connectSsl($host, $port);
                $smtp->expectStartsWith('220');
                $smtp->ehlo();
            } else {
                $smtp->connectStartTls($host, $port);
            }
            $smtp->authLogin($user, $pass);
            // OVH (and most providers) require the envelope sender (MAIL FROM)
            // to match the authenticated SMTP user. If the caller passes a
            // different From header, we still force the envelope to $user
            // so the server accepts the message. The From: header shown to
            // the recipient is built from $from in sendData().
            $envelopeFrom = $user;
            // Ensure the visible From uses the authenticated mailbox too —
            // otherwise Gmail/ISPs silently drop the message for failing
            // alignment (SPF domain vs From domain mismatch).
            $fromAddr = self::extractAddr($from);
            if (strcasecmp($fromAddr, $user) !== 0) {
                // Preserve display name if present, swap the address.
                if (preg_match('/^\s*(.*)<[^>]+>\s*$/', $from, $m) && trim($m[1]) !== '') {
                    $from = trim($m[1]) . ' <' . $user . '>';
                } else {
                    $from = $user;
                }
            }
            $smtp->mailFrom($envelopeFrom);
            $smtp->rcptTo($to);
            $smtp->sendData($from, $to, $subject, $html, $plain, $replyTo);
            $smtp->cmd("QUIT\r\n", [221]);
        } catch (Throwable $e) {
            self::$lastError = $e->getMessage();
            Logger::error('RemquipSmtp send failed', [
                'error' => $e->getMessage(),
                'host' => $host,
                'port' => $port,
                'enc' => $enc,
                'user' => $user,
                'from' => $from,
                'to' => $to,
            ]);
            $smtp->close();
            return false;
        }
        $smtp->close();
        return true;
    }

    private function connectSsl(string $host, int $port): void
    {
        $ctx = stream_context_create([
            'ssl' => [
                // OVH shared hosting frequently has a stale CA bundle which causes
                // `SSL connect failed` with no logs. We relax verification so the
                // handshake succeeds; auth still requires correct credentials.
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ],
        ]);
        $remote = 'ssl://' . $host . ':' . $port;
        $this->socket = @stream_socket_client(
            $remote,
            $errno,
            $errstr,
            30,
            STREAM_CLIENT_CONNECT,
            $ctx
        );
        if (!$this->socket) {
            throw new RuntimeException("SSL connect failed: $errstr ($errno)");
        }
        stream_set_timeout($this->socket, 30);
    }

    private function connectStartTls(string $host, int $port): void
    {
        $remote = 'tcp://' . $host . ':' . $port;
        $this->socket = @stream_socket_client($remote, $errno, $errstr, 30, STREAM_CLIENT_CONNECT);
        if (!$this->socket) {
            throw new RuntimeException("TCP connect failed: $errstr ($errno)");
        }
        stream_set_timeout($this->socket, 30);
        $this->expectStartsWith('220');
        $this->ehlo();
        $this->cmd("STARTTLS\r\n", [220]);
        $cryptoOk = @stream_socket_enable_crypto(
            $this->socket,
            true,
            STREAM_CRYPTO_METHOD_TLS_CLIENT
        );
        if (!$cryptoOk) {
            throw new RuntimeException('STARTTLS negotiation failed');
        }
        $this->ehlo();
    }

    private function ehlo(): void
    {
        $h = 'localhost';
        if (!empty($_SERVER['HTTP_HOST']) && is_string($_SERVER['HTTP_HOST'])) {
            $h = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST']);
        }
        $this->cmd("EHLO " . $h . "\r\n", [250]);
    }

    private function authLogin(string $user, string $pass): void
    {
        $this->cmd("AUTH LOGIN\r\n", [334]);
        $this->cmd(base64_encode($user) . "\r\n", [334]);
        $this->cmd(base64_encode($pass) . "\r\n", [235]);
    }

    private function mailFrom(string $addr): void
    {
        $this->cmd('MAIL FROM:<' . $addr . ">\r\n", [250]);
    }

    private function rcptTo(string $to): void
    {
        $this->cmd('RCPT TO:<' . $to . ">\r\n", [250, 251]);
    }

    /**
     * @param string[] $expectCodes
     */
    private function cmd(string $line, array $expectCodes): void
    {
        if ($this->socket === null) {
            throw new RuntimeException('No socket');
        }
        fwrite($this->socket, $line);
        $resp = $this->readResponse();
        $code = (int)substr(trim($resp), 0, 3);
        if (!in_array($code, $expectCodes, true)) {
            throw new RuntimeException('SMTP unexpected: ' . trim($resp));
        }
    }

    private function expectStartsWith(string $prefix): void
    {
        $resp = $this->readResponse();
        if (strpos($resp, $prefix) !== 0) {
            throw new RuntimeException('SMTP greeting: ' . trim($resp));
        }
    }

    private function readResponse(): string
    {
        if ($this->socket === null) {
            throw new RuntimeException('No socket');
        }
        $data = '';
        while (($line = fgets($this->socket, 8192)) !== false) {
            $data .= $line;
            if (strlen($line) >= 4 && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    }

    private function sendData(
        string $from,
        string $to,
        string $subject,
        string $htmlBody,
        ?string $plainBody,
        ?string $replyTo
    ): void {
        $this->cmd("DATA\r\n", [354]);
        $boundary = 'b' . bin2hex(random_bytes(12));
        $subj = self::encodeSubject($subject);

        $plain = $plainBody !== null && $plainBody !== ''
            ? $plainBody
            : self::htmlToApproxPlain($htmlBody);

        // Build RFC 5322 compliant Message-ID using the sender's domain.
        // Gmail (and other strict receivers) reject messages lacking a valid
        // Message-ID header with 550-5.7.1 RfcMessageNonCompliant.
        $fromAddr = self::extractAddr($from);
        $atPos = strrpos($fromAddr, '@');
        $msgIdDomain = ($atPos !== false) ? substr($fromAddr, $atPos + 1) : 'localhost';
        // Sanitize domain (strip any stray whitespace/angle brackets)
        $msgIdDomain = preg_replace('/[^A-Za-z0-9\.\-]/', '', $msgIdDomain) ?: 'localhost';
        $messageId = '<' . bin2hex(random_bytes(16)) . '.' . time() . '@' . $msgIdDomain . '>';

        $lines = [];
        $lines[] = 'Date: ' . date('r'); // RFC 2822 date
        $lines[] = 'Message-ID: ' . $messageId;
        $lines[] = 'From: ' . $from;
        $lines[] = 'To: <' . $to . '>';
        if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
            $lines[] = 'Reply-To: <' . $replyTo . '>';
        }
        $lines[] = 'MIME-Version: 1.0';
        $lines[] = 'Subject: ' . $subj;
        $lines[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
        $lines[] = '';
        $lines[] = '--' . $boundary;
        $lines[] = 'Content-Type: text/plain; charset=UTF-8';
        $lines[] = 'Content-Transfer-Encoding: base64';
        $lines[] = '';
        $lines[] = chunk_split(base64_encode($plain), 76, "\r\n");
        $lines[] = '--' . $boundary;
        $lines[] = 'Content-Type: text/html; charset=UTF-8';
        $lines[] = 'Content-Transfer-Encoding: base64';
        $lines[] = '';
        $lines[] = chunk_split(base64_encode($htmlBody), 76, "\r\n");
        $lines[] = '--' . $boundary . '--';

        $payload = implode("\r\n", $lines);
        $payload = self::escapeDataDots($payload);
        fwrite($this->socket, $payload . "\r\n.\r\n");
        $last = $this->readResponse();
        $code = (int)substr(trim($last), 0, 3);
        if ($code !== 250) {
            throw new RuntimeException('DATA failed: ' . trim($last));
        }
    }

    /** SMTP DATA: lines starting with . must be doubled */
    private static function escapeDataDots(string $s): string
    {
        return preg_replace('/^\./m', '..', $s);
    }

    private static function encodeSubject(string $subject): string
    {
        return '=?UTF-8?B?' . base64_encode($subject) . '?=';
    }

    private static function extractAddr(string $from): string
    {
        if (preg_match('/<([^>]+)>/', $from, $m)) {
            return trim($m[1]);
        }
        return trim($from);
    }

    private static function htmlToApproxPlain(string $html): string
    {
        $t = preg_replace('/\s+/', ' ', strip_tags($html));

        return $t !== null ? trim($t) : '';
    }

    private function close(): void
    {
        if (is_resource($this->socket)) {
            @fclose($this->socket);
        }
        $this->socket = null;
    }
}
