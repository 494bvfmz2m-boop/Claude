'use strict';

// Turns a User-Agent string into something people recognise: "Chrome on Windows".
function describeDevice(ua = '') {
    const has = re => re.test(ua);
    let os = 'Unknown device';
    if (has(/iPhone/)) os = 'iPhone';
    else if (has(/iPad/) || (has(/Macintosh/) && has(/Mobile/))) os = 'iPad';
    else if (has(/Android/)) os = has(/Mobile/) ? 'Android phone' : 'Android tablet';
    else if (has(/Windows/)) os = 'Windows';
    else if (has(/CrOS/)) os = 'ChromeOS';
    else if (has(/Mac OS X|Macintosh/)) os = 'Mac';
    else if (has(/Linux/)) os = 'Linux';

    let browser = '';
    if (has(/Edg\//)) browser = 'Edge';
    else if (has(/OPR\/|Opera/)) browser = 'Opera';
    else if (has(/Firefox\/|FxiOS/)) browser = 'Firefox';
    else if (has(/Chrome\/|CriOS/)) browser = 'Chrome';
    else if (has(/Safari\//)) browser = 'Safari';
    else if (has(/curl|wget|python|node/i)) browser = 'Script';

    const kind = /iPhone|Android phone/.test(os) ? 'phone' : /iPad|tablet/.test(os) ? 'tablet' : 'desktop';
    return { os, browser, kind, label: browser ? `${browser} on ${os}` : os };
}

module.exports = { describeDevice };
