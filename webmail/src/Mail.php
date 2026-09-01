<?php
declare(strict_types=1);

class Mail {
    private $imap = null;
    private string $host;
    private int $imapPort;
    private int $smtpPort;
    private string $user;
    private string $pass;
    private string $lastError = '';

    public function __construct(string $host, int $imapPort, int $smtpPort, string $user, string $pass) {
        $this->host     = $host;
        $this->imapPort = $imapPort;
        $this->smtpPort = $smtpPort;
        $this->user     = $user;
        $this->pass     = $pass;
    }

    public function connect(string $mailbox = 'INBOX'): bool {
        $dsn = "{{$this->host}:{$this->imapPort}/imap/ssl/novalidate-cert}$mailbox";
        imap_errors(); // clear any error backlog from a previous connection attempt
        $this->imap = @imap_open($dsn, $this->user, $this->pass, 0, 1);
        if ($this->imap === false) {
            $errors = imap_errors();
            $alert  = imap_last_error();
            $this->lastError = $alert ?: ($errors ? implode('; ', $errors) : 'Unknown IMAP error');
            return false;
        }
        return true;
    }

    // Real reason the last connect() failed (auth failure vs. TLS/network/server issue),
    // used server-side only so login errors stop being blamed on the password by default.
    public function getLastError(): string {
        return $this->lastError;
    }

    public function disconnect(): void {
        if ($this->imap) { imap_close($this->imap, CL_EXPUNGE); $this->imap = null; }
    }

    public function getFolders(): array {
        $dsn  = "{{$this->host}:{$this->imapPort}/imap/ssl/novalidate-cert}";
        $list = imap_list($this->imap, $dsn, '*');
        if (!$list) return [];
        return array_map(fn($f) => mb_convert_encoding(
            str_replace($dsn, '', imap_utf7_decode($f)), 'UTF-8', 'UTF-8'
        ), $list);
    }

    public function renameFolder(string $oldName, string $newName): bool {
        $dsn = "{{$this->host}:{$this->imapPort}/imap/ssl/novalidate-cert}";
        return imap_renamemailbox($this->imap, $dsn . $oldName, $dsn . $newName);
    }

    public function createFolder(string $name): bool {
        $dsn = "{{$this->host}:{$this->imapPort}/imap/ssl/novalidate-cert}";
        return imap_createmailbox($this->imap, $dsn . $name);
    }

    public function getMessages(int $page = 1, int $perPage = 20): array {
        $total = imap_num_msg($this->imap);
        if ($total === 0) return ['messages' => [], 'total' => 0];
        $start     = max(1, $total - ($page * $perPage) + 1);
        $end       = max(1, $total - (($page - 1) * $perPage));
        $overviews = imap_fetch_overview($this->imap, "$start:$end", 0);
        if (!$overviews) return ['messages' => [], 'total' => $total];
        $messages = [];
        foreach (array_reverse($overviews) as $o) {
            $messages[] = [
                'uid'     => $o->uid ?? 0,
                'msgno'   => $o->msgno ?? 0,
                'subject' => $this->decodeHeader($o->subject ?? '(no subject)'),
                'from'    => $this->decodeHeader($o->from ?? ''),
                'date'    => $o->date ?? '',
                'seen'    => (bool)($o->seen ?? false),
                'flagged' => (bool)($o->flagged ?? false),
            ];
        }
        return ['messages' => $messages, 'total' => $total];
    }

    public function getMessage(int $uid): array {
        $msgno = imap_msgno($this->imap, $uid);
        if ($msgno === 0) throw new RuntimeException('Message not found.');

        // Parse headers safely
        $rawHeader = imap_fetchheader($this->imap, $msgno);
        $header    = imap_rfc822_parse_headers($rawHeader);

        // Parse structure safely
        $struct = imap_fetchstructure($this->imap, $msgno);
        if (!$struct) throw new RuntimeException('Could not read message structure.');

        $plain = ''; $htmlBody = ''; $attachments = [];
        $this->parseStructure($msgno, $struct, $plain, $htmlBody, $attachments, '');

        // If we got nothing from structure parsing, try fetching body part 1 directly
        if (!$plain && !$htmlBody) {
            $raw = imap_fetchbody($this->imap, $msgno, '1');
            $enc = $struct->encoding ?? 0;
            $plain = $this->decodeBody($raw, $enc);
            // Try 1.1 and 1.2 as fallback for multipart
            if (!$plain) {
                $raw   = imap_fetchbody($this->imap, $msgno, '1.1');
                $plain = $this->decodeBody($raw, $enc);
            }
            if (!$htmlBody) {
                $raw     = imap_fetchbody($this->imap, $msgno, '1.2');
                $htmlBody = $this->decodeBody($raw, $enc);
            }
        }

        @imap_setflag_full($this->imap, (string)$msgno, '\\Seen');

        $body = '';
        if ($htmlBody) {
            $body = $htmlBody;
        } elseif ($plain) {
            $body = '<pre style="white-space:pre-wrap;font-family:inherit;line-height:1.65">' . htmlspecialchars($plain, ENT_QUOTES, 'UTF-8') . '</pre>';
        } else {
            $body = '<em style="color:#6b7090">This message has no readable content.</em>';
        }

        return [
            'uid'         => $uid,
            'subject'     => $this->decodeHeader($header->subject ?? '(no subject)'),
            'from'        => $this->addressToString($header->from ?? []),
            'to'          => $this->addressToString($header->to ?? []),
            'cc'          => $this->addressToString($header->cc ?? []),
            'date'        => $header->date ?? '',
            'body'        => $body,
            'attachments' => $attachments,
        ];
    }

    public function sendMessage(string $to, string $subject, string $body, string $cc = ''): bool {
        $socket = @stream_socket_client("ssl://{$this->host}:{$this->smtpPort}", $errno, $errstr, 15);
        if (!$socket) return false;
        try {
            $this->smtpExpect($socket, 220);
            $this->smtpSend($socket, "EHLO {$this->host}"); $this->smtpExpect($socket, 250);
            $this->smtpSend($socket, 'AUTH LOGIN');         $this->smtpExpect($socket, 334);
            $this->smtpSend($socket, base64_encode($this->user)); $this->smtpExpect($socket, 334);
            $this->smtpSend($socket, base64_encode($this->pass)); $this->smtpExpect($socket, 235);
            $this->smtpSend($socket, "MAIL FROM:<{$this->user}>"); $this->smtpExpect($socket, 250);
            foreach (array_map('trim', explode(',', $to)) as $addr) {
                if ($addr) { $this->smtpSend($socket, "RCPT TO:<$addr>"); $this->smtpExpect($socket, 250); }
            }
            $this->smtpSend($socket, 'DATA'); $this->smtpExpect($socket, 354);
            $date    = date('r');
            $msgId   = '<' . uniqid('', true) . '@' . explode('@', $this->user)[1] . '>';
            $headers = "Date: $date\r\nFrom: {$this->user}\r\nTo: $to\r\n";
            if ($cc) $headers .= "Cc: $cc\r\n";
            $headers .= "Message-ID: $msgId\r\nSubject: " . mb_encode_mimeheader($subject, 'UTF-8') . "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n";
            $encoded = chunk_split(base64_encode($body));
            $this->smtpSend($socket, $headers . "\r\n" . $encoded . "\r\n.");
            $this->smtpExpect($socket, 250);
            $this->smtpSend($socket, 'QUIT');
            fclose($socket);
            $this->saveToSent($headers . "\r\n" . $encoded);
            return true;
        } catch (\Throwable $e) {
            @fclose($socket);
            return false;
        }
    }

    public function deleteMessage(int $uid): bool {
        $msgno = imap_msgno($this->imap, $uid);
        return $msgno ? imap_delete($this->imap, (string)$msgno) !== false : false;
    }

    public function toggleFlag(int $uid, string $flag): bool {
        $msgno = imap_msgno($this->imap, $uid);
        if (!$msgno) return false;
        $overview = imap_fetch_overview($this->imap, (string)$msgno, 0);
        if (!$overview) return false;
        $flagMap  = ['flagged' => '\\Flagged', 'seen' => '\\Seen'];
        $imapFlag = $flagMap[$flag] ?? null;
        if (!$imapFlag) return false;
        $prop = $flag;
        if ($overview[0]->$prop ?? false) return imap_clearflag_full($this->imap, (string)$msgno, $imapFlag) !== false;
        return imap_setflag_full($this->imap, (string)$msgno, $imapFlag) !== false;
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private function parseStructure(int $msgno, object $struct, string &$plain, string &$html, array &$attachments, string $prefix): void {
        // Multipart: recurse into parts
        if (isset($struct->parts) && is_array($struct->parts)) {
            foreach ($struct->parts as $i => $part) {
                $partNo = $prefix === '' ? (string)($i + 1) : $prefix . '.' . ($i + 1);
                $this->parseStructure($msgno, $part, $plain, $html, $attachments, $partNo);
            }
            return;
        }

        $partNo  = $prefix === '' ? '1' : $prefix;
        $type    = (int)($struct->type ?? 0);
        $subtype = strtolower($struct->subtype ?? 'plain');

        // Check if it's an attachment
        $isAttachment = false;
        if (isset($struct->disposition) && strtolower($struct->disposition) === 'attachment') {
            $isAttachment = true;
        }
        if (isset($struct->ifparameters) && $struct->ifparameters) {
            foreach ($struct->parameters ?? [] as $p) {
                if (strtolower($p->attribute) === 'name') { $isAttachment = true; break; }
            }
        }

        if ($isAttachment) {
            $filename = $this->getFilename($struct);
            $attachments[] = ['name' => $filename, 'part' => $partNo];
            return;
        }

        // Only decode text parts
        if ($type !== 0) return; // 0 = TEXT

        $raw     = @imap_fetchbody($this->imap, $msgno, $partNo);
        $decoded = $this->decodeBody($raw ?? '', (int)($struct->encoding ?? 0));

        // Convert charset
        $charset = 'UTF-8';
        if (!empty($struct->parameters)) {
            foreach ($struct->parameters as $p) {
                if (strtolower($p->attribute) === 'charset') { $charset = $p->value; break; }
            }
        }
        if (strtoupper($charset) !== 'UTF-8') {
            $converted = @mb_convert_encoding($decoded, 'UTF-8', $charset);
            if ($converted !== false) $decoded = $converted;
        }

        if ($subtype === 'html' && !$html)  { $html  = $decoded; }
        elseif ($subtype === 'plain' && !$plain) { $plain = $decoded; }
    }

    private function decodeBody(string $data, int $encoding): string {
        return match ($encoding) {
            1 => imap_utf8($data),                                          // UTF-7
            2, 3 => base64_decode(str_replace(["\r", "\n"], '', $data)),    // BASE64
            4 => quoted_printable_decode($data),                            // QP
            default => $data,                                               // 7BIT / 8BIT / BINARY
        };
    }

    private function getFilename(object $struct): string {
        // Check disposition parameters first
        if (!empty($struct->dparameters)) {
            foreach ($struct->dparameters as $p) {
                if (strtolower($p->attribute) === 'filename') return $this->decodeHeader($p->value);
            }
        }
        // Fall back to content-type parameters
        if (!empty($struct->parameters)) {
            foreach ($struct->parameters as $p) {
                if (strtolower($p->attribute) === 'name') return $this->decodeHeader($p->value);
            }
        }
        return 'attachment';
    }

    private function saveToSent(string $raw): void {
        $dsn = "{{$this->host}:{$this->imapPort}/imap/ssl/novalidate-cert}Sent";
        @imap_append($this->imap, $dsn, $raw, '\\Seen');
    }

    private function decodeHeader(string $header): string {
        if (!$header) return '';
        $parts  = @imap_mime_header_decode($header);
        if (!$parts) return $header;
        $result = '';
        foreach ($parts as $part) {
            $charset = (!$part->charset || $part->charset === 'default') ? 'UTF-8' : $part->charset;
            $text    = $part->text ?? '';
            if (strtoupper($charset) !== 'UTF-8') {
                $converted = @mb_convert_encoding($text, 'UTF-8', $charset);
                $text = $converted !== false ? $converted : $text;
            }
            $result .= $text;
        }
        return $result;
    }

    private function addressToString(array $addresses): string {
        if (!$addresses) return '';
        return implode(', ', array_map(fn($a) =>
            isset($a->personal) && $a->personal
                ? "{$this->decodeHeader($a->personal)} <{$a->mailbox}@{$a->host}>"
                : (isset($a->mailbox) ? "{$a->mailbox}@{$a->host}" : ''),
            $addresses
        ));
    }

    private function smtpSend($socket, string $cmd): void { fwrite($socket, "$cmd\r\n"); }

    private function smtpExpect($socket, int $code): string {
        $response = '';
        while ($line = fgets($socket, 512)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') break;
        }
        if ((int)substr($response, 0, 3) !== $code)
            throw new \RuntimeException("SMTP expected $code, got: $response");
        return $response;
    }
}
