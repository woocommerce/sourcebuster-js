## 1.3.0

Features:
- Add `fields` option to only write the listed `container.field` paths to cookies

Fixes:
- Bound managed Sourcebuster cookie payloads to 2,304 request bytes in plain and Base64 modes, to avoid HTTP 400/414 errors from oversized Cookie headers.
- Trim long values on whole characters and whole percent-encoded sequences, so non-ASCII UTM values still decode after trimming.
- Escape every `|` in stored values, so a value ending in `|` cannot break the `|||` field delimiter.
- Store URL values decoded once, so a non-ASCII character uses its UTF-8 escape once instead of twice. A Japanese `utm_content` now keeps about 28 characters instead of 17 in plain mode, and 17 instead of 10 in Base64 mode. Values read through `sbjs.get` are unchanged.
- Keep malformed percent escapes in URL values as they are, instead of decoding them to unrelated characters.

Data changes:
- `ep` and `cpg` now store the page path only, without origin, query string or hash. Example: `/product/test-shirt/` instead of `https://shop.example/product/test-shirt/?utm_source=google`.
- `rf` now stores the referrer origin and path, without query string or hash.
- Long values are trimmed to per-field and per-cookie byte budgets. When a cookie is still over budget, fields are emptied in a fixed order, starting with `uag`, `rf` and `cnt`.

## 1.2.0

Features:
- Add `base64` option to Base64-encode cookie contents
- Add GA4 UTM parameters: `utm_source_platform`, `utm_creative_format` and `utm_marketing_tactic`

## 1.1.2

Features:
- Add `utm_id` parameter handling

Changes:
- Add `.nvmrc` with `lts/iron` (v20)
- Use `dart-sass` instead of `node-sass`
- Update dependencies to work with Node 20

## 1.1.1

Changes:
- Fork from the original repo (`alex35mil/sourcebuster-js`)

## 1.1.0

Features:
- Add Yandex click ID handling (`yclid`)

Fixes:
- Avoid `-0` custom UTC offset value

Changes:
- Update dependencies

## 1.0.5

Features:

  - added `t.co` (`host: 't.co', display: 'twitter.com'`) and `plus.url.google.com` (`host: 'plus.url.google.com', display: 'plus.google.com'`) to default `referral` sources. You still can override it by your custom setting (to mark it as `social` for example).

## 1.0.4

Fixes:

  - fixed IE8 bug

## 1.0.3

Fixes:

  - fixed month in dates (`sbjs.get.first_add.fd` & `sbjs.get.current_add.fd`): it was -1 from actual one

## 1.0.2

Fixes:

  - fixed validation of `lifetime`, `session_length` and `timezone_offset` params

## 1.0.0

[Upgrade guide](UPGRADING.md) &middot; [Updated documentation](README.md)

Changes:

_Major_

  - API. Rewritten from the ground. See [upgrade guide](UPGRADING.md) and [updated documentation](README.md).
  - Changed cookie's domain handling — also see [upgrade guide](UPGRADING.md) and [updated documentation](README.md).
  - Changed default `utm_source` & `utm_medium` values for `typein` traffic — you know [what to do](UPGRADING.md) :)

_Minor_

  - Changed default timezone from UTC to user's system (default — means no custom value provided during `sbjs` initialization).

_Under the hood_

  - In short: `mess` became `structure`. Check the sources if interested.
  - Added migration tool, which updates visitor's cookies to `1.x.x`.
  - Changed params delimiter in cookies: from `|` to `|||`. Cookies will be automatically upgraded by migration tool without data loss. You don't have to worry about this change unless you parse these cookies by yourself.

Features:

  - Added `callback` option to set custom function, which will be executed right after `sbjs` cookies will be set. This function will get `sbjs.get`-object as argument (it contains all detected `sbjs` data).
  - Added ability to set custom cookies expiration period
  - Added `term` detection from Yandex Direct traffic (if there is no `utm_term` in URL)
  - Added `visits` counter: available through `sbjs.get.udata.vst`
  - Added `pages` counter for current session: available through `sbjs.get.session.pgs`
  - Added `current page` url for current session: available through `sbjs.get.session.cpg`
  - And Sourcebuster `1.0.0` available as `CommonJS` / `AMD` module.

## 0.0.7

Features:

  - add `sbjs_current_add` cookie, which holds same data as `sbjs_first_add` cookie, but for the visit when current source was written
  - add info about first referer (see changes below)

Changes:

  - move current `referer` data from stand-alone `sbjs_referer` cookie to `sbjs_current_add` cookie (and also to `sbjs_first_add` cookie, now you can get first and current referers via `get_sbjs.first_add.rf` & `get_sbjs.current_add.rf` getters)

## 0.0.6

Features:

  - add `_setPromocode` user setting to set promocode for visitor;

## 0.0.5

Features:

  - add `_setTypeinAttributes` user setting to set custom `source` and `medium` for `typein` traffic
  - set value of `content` = `referer_path` in cookies for `referral` traffic

## 0.0.4

Features:

  - add predefined organic sources into the core (see comments and the list of added sources [in the docs](./README.md#_addorganicsource))
  - add Sourcebuster to `bower` ([bower.io](http://bower.io)). Now you can [install it via... `bower`](./README.md#install)

Changes:

  - switch from Closure Compiler to UglifyJS minification library
  - switch from deprecated `escape()`/`unescape()` methods to custom `encode_data()`/`decode_data()` functions (which uses `encodeURIComponent()`/`decodeURIComponent()` with some additions) to set/get cookies. **Please pay attention to this if you parse `sbjs` cookies by yourself.**

## 0.0.3

Features:

  - add `_setTimeZoneOffset` user setting to set default time zone
  - add alias param to custom organic source (added via `_addOrganicSource`)

Changes:

  - change simple and advanced setup methods
  - change datetime format to `yyyy-mm-dd hh:mm:ss` (`2014-06-11 17:28:26`)
  - store datetime in UTC by default
  - remove events `'sbjs:set'` and `'sbjs:ready'` (see *Using the data* section for details)

Fixes:

  - fix matching of Yandex organic source
  - fix matching of custom organic source (added via `_addOrganicSource`)
  - fix getter (`get_sbjs`) in IE8 and lower
  - fix output of non-ASCII chars via `get_sbjs`

## 0.0.2

Features:

  - add Google AdWords `gclid` param handler
  - add `_setCampaignParam` user setting to set custom GET-param, whose value will be set as `utm_campaign` in cookies (if there is no original `utm_campaign` in request)

## 0.0.1

Sourcebuster JS released.
