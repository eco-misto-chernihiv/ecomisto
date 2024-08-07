import './chunks/astro/server_CFD6V1YY.mjs';

if (typeof process !== "undefined") {
  let proc = process;
  if ("argv" in proc && Array.isArray(proc.argv)) {
    if (proc.argv.includes("--verbose")) ; else if (proc.argv.includes("--silent")) ; else ;
  }
}

/**
 * Tokenize input string.
 */
function lexer(str) {
    var tokens = [];
    var i = 0;
    while (i < str.length) {
        var char = str[i];
        if (char === "*" || char === "+" || char === "?") {
            tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
            continue;
        }
        if (char === "\\") {
            tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
            continue;
        }
        if (char === "{") {
            tokens.push({ type: "OPEN", index: i, value: str[i++] });
            continue;
        }
        if (char === "}") {
            tokens.push({ type: "CLOSE", index: i, value: str[i++] });
            continue;
        }
        if (char === ":") {
            var name = "";
            var j = i + 1;
            while (j < str.length) {
                var code = str.charCodeAt(j);
                if (
                // `0-9`
                (code >= 48 && code <= 57) ||
                    // `A-Z`
                    (code >= 65 && code <= 90) ||
                    // `a-z`
                    (code >= 97 && code <= 122) ||
                    // `_`
                    code === 95) {
                    name += str[j++];
                    continue;
                }
                break;
            }
            if (!name)
                throw new TypeError("Missing parameter name at ".concat(i));
            tokens.push({ type: "NAME", index: i, value: name });
            i = j;
            continue;
        }
        if (char === "(") {
            var count = 1;
            var pattern = "";
            var j = i + 1;
            if (str[j] === "?") {
                throw new TypeError("Pattern cannot start with \"?\" at ".concat(j));
            }
            while (j < str.length) {
                if (str[j] === "\\") {
                    pattern += str[j++] + str[j++];
                    continue;
                }
                if (str[j] === ")") {
                    count--;
                    if (count === 0) {
                        j++;
                        break;
                    }
                }
                else if (str[j] === "(") {
                    count++;
                    if (str[j + 1] !== "?") {
                        throw new TypeError("Capturing groups are not allowed at ".concat(j));
                    }
                }
                pattern += str[j++];
            }
            if (count)
                throw new TypeError("Unbalanced pattern at ".concat(i));
            if (!pattern)
                throw new TypeError("Missing pattern at ".concat(i));
            tokens.push({ type: "PATTERN", index: i, value: pattern });
            i = j;
            continue;
        }
        tokens.push({ type: "CHAR", index: i, value: str[i++] });
    }
    tokens.push({ type: "END", index: i, value: "" });
    return tokens;
}
/**
 * Parse a string for the raw tokens.
 */
function parse(str, options) {
    if (options === void 0) { options = {}; }
    var tokens = lexer(str);
    var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a;
    var defaultPattern = "[^".concat(escapeString(options.delimiter || "/#?"), "]+?");
    var result = [];
    var key = 0;
    var i = 0;
    var path = "";
    var tryConsume = function (type) {
        if (i < tokens.length && tokens[i].type === type)
            return tokens[i++].value;
    };
    var mustConsume = function (type) {
        var value = tryConsume(type);
        if (value !== undefined)
            return value;
        var _a = tokens[i], nextType = _a.type, index = _a.index;
        throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
    };
    var consumeText = function () {
        var result = "";
        var value;
        while ((value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR"))) {
            result += value;
        }
        return result;
    };
    while (i < tokens.length) {
        var char = tryConsume("CHAR");
        var name = tryConsume("NAME");
        var pattern = tryConsume("PATTERN");
        if (name || pattern) {
            var prefix = char || "";
            if (prefixes.indexOf(prefix) === -1) {
                path += prefix;
                prefix = "";
            }
            if (path) {
                result.push(path);
                path = "";
            }
            result.push({
                name: name || key++,
                prefix: prefix,
                suffix: "",
                pattern: pattern || defaultPattern,
                modifier: tryConsume("MODIFIER") || "",
            });
            continue;
        }
        var value = char || tryConsume("ESCAPED_CHAR");
        if (value) {
            path += value;
            continue;
        }
        if (path) {
            result.push(path);
            path = "";
        }
        var open = tryConsume("OPEN");
        if (open) {
            var prefix = consumeText();
            var name_1 = tryConsume("NAME") || "";
            var pattern_1 = tryConsume("PATTERN") || "";
            var suffix = consumeText();
            mustConsume("CLOSE");
            result.push({
                name: name_1 || (pattern_1 ? key++ : ""),
                pattern: name_1 && !pattern_1 ? defaultPattern : pattern_1,
                prefix: prefix,
                suffix: suffix,
                modifier: tryConsume("MODIFIER") || "",
            });
            continue;
        }
        mustConsume("END");
    }
    return result;
}
/**
 * Compile a string to a template function for the path.
 */
function compile(str, options) {
    return tokensToFunction(parse(str, options), options);
}
/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction(tokens, options) {
    if (options === void 0) { options = {}; }
    var reFlags = flags(options);
    var _a = options.encode, encode = _a === void 0 ? function (x) { return x; } : _a, _b = options.validate, validate = _b === void 0 ? true : _b;
    // Compile all the tokens into regexps.
    var matches = tokens.map(function (token) {
        if (typeof token === "object") {
            return new RegExp("^(?:".concat(token.pattern, ")$"), reFlags);
        }
    });
    return function (data) {
        var path = "";
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (typeof token === "string") {
                path += token;
                continue;
            }
            var value = data ? data[token.name] : undefined;
            var optional = token.modifier === "?" || token.modifier === "*";
            var repeat = token.modifier === "*" || token.modifier === "+";
            if (Array.isArray(value)) {
                if (!repeat) {
                    throw new TypeError("Expected \"".concat(token.name, "\" to not repeat, but got an array"));
                }
                if (value.length === 0) {
                    if (optional)
                        continue;
                    throw new TypeError("Expected \"".concat(token.name, "\" to not be empty"));
                }
                for (var j = 0; j < value.length; j++) {
                    var segment = encode(value[j], token);
                    if (validate && !matches[i].test(segment)) {
                        throw new TypeError("Expected all \"".concat(token.name, "\" to match \"").concat(token.pattern, "\", but got \"").concat(segment, "\""));
                    }
                    path += token.prefix + segment + token.suffix;
                }
                continue;
            }
            if (typeof value === "string" || typeof value === "number") {
                var segment = encode(String(value), token);
                if (validate && !matches[i].test(segment)) {
                    throw new TypeError("Expected \"".concat(token.name, "\" to match \"").concat(token.pattern, "\", but got \"").concat(segment, "\""));
                }
                path += token.prefix + segment + token.suffix;
                continue;
            }
            if (optional)
                continue;
            var typeOfMessage = repeat ? "an array" : "a string";
            throw new TypeError("Expected \"".concat(token.name, "\" to be ").concat(typeOfMessage));
        }
        return path;
    };
}
/**
 * Escape a regular expression string.
 */
function escapeString(str) {
    return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
/**
 * Get the flags for a regexp from the options.
 */
function flags(options) {
    return options && options.sensitive ? "" : "i";
}

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getRouteGenerator(segments, addTrailingSlash) {
  const template = segments.map((segment) => {
    return "/" + segment.map((part) => {
      if (part.spread) {
        return `:${part.content.slice(3)}(.*)?`;
      } else if (part.dynamic) {
        return `:${part.content}`;
      } else {
        return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }).join("");
  }).join("");
  let trailing = "";
  if (addTrailingSlash === "always" && segments.length) {
    trailing = "/";
  }
  const toPath = compile(template + trailing);
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    const path = toPath(sanitizedParams);
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware(_, next) {
      return next();
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes
  };
}

const manifest = deserializeManifest({"adapterName":"@astrojs/netlify","routes":[{"file":"projects/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/projects","isIndex":true,"type":"page","pattern":"^\\/projects\\/?$","segments":[[{"content":"projects","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/projects/index.astro","pathname":"/projects","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"typography/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/typography","isIndex":false,"type":"page","pattern":"^\\/typography\\/?$","segments":[[{"content":"typography","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/typography.astro","pathname":"/typography","prerender":true,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/.pnpm/astro@4.11.1_@types+node@20.12.11_typescript@5.5.2/node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/checkout","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/checkout\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"checkout","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/checkout.ts","pathname":"/api/checkout","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/liqpay-sendpulse","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/liqpay-sendpulse\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"liqpay-sendpulse","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/liqpay-sendpulse.ts","pathname":"/api/liqpay-sendpulse","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/request-partnership","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/request-partnership\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"request-partnership","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/request-partnership.ts","pathname":"/api/request-partnership","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.6BXvnG-P.js"}],"styles":[{"type":"external","src":"/_astro/hoisted.CCRaorum.css"},{"type":"external","src":"/_astro/index.sZqD5BbP.css"},{"type":"inline","content":".arrow[data-astro-cid-xxwwxqrn]{--_size:40px;height:40px;height:var(--_size);width:40px;width:var(--_size);--_color:initial;--_bg-color:initial;align-items:center;background-color:var(--_bg-color);border:2px solid transparent;border-radius:var(--rounded-full);color:var(--_color);display:flex;flex-shrink:0;justify-content:center;padding:var(--space-1-fixed)}.arrow[data-astro-cid-xxwwxqrn] svg[data-astro-cid-xxwwxqrn]{height:1.5em;width:1.5em}.arrow[data-astro-cid-xxwwxqrn].primary{--_color:var(--color-secondary);--_bg-color:var(--color-primary)}.arrow[data-astro-cid-xxwwxqrn].secondary{--_color:var(--color-primary);--_bg-color:var(--color-secondary)}.arrow[data-astro-cid-xxwwxqrn].left svg[data-astro-cid-xxwwxqrn]{transform:rotate(-180deg)}.swiper-button[data-astro-cid-5nycpk2d]{cursor:pointer;transition:color var(--transition-default),background-color var(--transition-default),transform var(--transition-default)}.swiper-button[data-astro-cid-5nycpk2d] .arrow{transition:transform var(--transition-default)}.swiper-button[data-astro-cid-5nycpk2d]:hover .arrow{background-color:var(--color-secondary);color:var(--color-primary)}.swiper-button-disabled[data-astro-cid-5nycpk2d]{cursor:auto;opacity:0;pointer-events:none}.swiper-button[data-astro-cid-5nycpk2d][data-direction=left]:hover .arrow{transform:translate(-4px)}.swiper-button[data-astro-cid-5nycpk2d][data-direction=right]:hover .arrow{transform:translate(4px)}.swiper-pagination-wrapper[data-astro-cid-jkc3otgp]{flex:1;position:relative}.swiper-pagination[data-astro-cid-jkc3otgp]{background-color:var(--color-gray-200);border-radius:var(--rounded-full);height:4px;width:100%}.round-corner[data-astro-cid-jkc3otgp]{background-color:var(--color-secondary);border-bottom-left-radius:var(--rounded-full);border-top-left-radius:var(--rounded-full);height:4px;left:-4px;position:absolute;width:8px}.empty-shape[data-astro-cid-dns2enbp]{bottom:var(--bottom);left:var(--left);position:absolute;right:var(--right);top:var(--top)}.auto-grid[data-astro-cid-d3reksu5]{--_max-column-count:calc(100%/var(--maxColumns, infinity) - var(--gap));--_column-width:max(var(--_max-column-count),min(var(--minItemWidth),100%));display:grid;grid-gap:var(--gap);gap:var(--gap)}@supports (width:min(250px,100%)){.auto-grid[data-astro-cid-d3reksu5]{grid-template-columns:repeat(auto-fit,minmax(var(--_column-width),1fr))}}\n"},{"type":"external","src":"/_astro/index.CLF_GW0n.css"},{"type":"inline","content":".section[data-astro-cid-5v3l7meg]{--_border-radius:var(--rounded-2xl);background-color:var(--background)}@media (min-width:68.75em){.section[data-astro-cid-5v3l7meg]{--_border-radius:var(--rounded-3xl)}}.round[data-astro-cid-5v3l7meg]{border-radius:var(--_border-radius)}.round-top[data-astro-cid-5v3l7meg]{border-top-left-radius:var(--_border-radius);border-top-right-radius:var(--_border-radius)}.round-bottom[data-astro-cid-5v3l7meg]{border-bottom-left-radius:var(--_border-radius);border-bottom-right-radius:var(--_border-radius)}.row[data-astro-cid-l73y7qbm]{display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:1fr auto}.frame{align-items:center;aspect-ratio:var(--left) /var(--right);display:flex;justify-content:center;overflow:hidden}.frame>img,.frame>picture,.frame>picture>img,.frame>video{height:100%;-o-object-fit:cover;object-fit:cover;width:100%}.frame>iframe{height:100%;width:100%}.project-card[data-astro-cid-mspuyifq] a{width:100%}.project-card[data-astro-cid-mspuyifq] .cover-wrapper{background-color:var(--color-accent);transition:filter .3s var(--ease-out)}.project-card[data-astro-cid-mspuyifq] .cover-wrapper img{transition:transform .3s var(--ease-out)}.project-card[data-astro-cid-mspuyifq] .title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden;transition:color var(--transition-default)}.project-card[data-astro-cid-mspuyifq] .description{display:-webkit-box;max-width:28rem;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}.project-card[data-astro-cid-mspuyifq] svg{--_size:var(--space-6);flex-shrink:0;height:var(--space-6);height:var(--_size);transform:translateY(7px) rotate(-45deg);transition:transform var(--transition-default);width:var(--space-6);width:var(--_size)}.project-card[data-astro-cid-mspuyifq]:hover .cover-wrapper{filter:brightness(103%)}.project-card[data-astro-cid-mspuyifq]:hover .cover-wrapper img{transform:scale3d(1.05,1.05,1.05)}.project-card[data-astro-cid-mspuyifq]:hover .title{color:var(--color-primary)}.project-card[data-astro-cid-mspuyifq]:hover svg{transform:translateY(7px) rotate(0)}.time-period[data-astro-cid-d7abjbmi]{background-color:var(--color-accent);border-radius:9999px;padding:calc(var(--space-1) + 1px) var(--space-3);width:-moz-fit-content;width:fit-content}.time-period[data-astro-cid-d7abjbmi] p[data-astro-cid-d7abjbmi]{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}\n"},{"type":"external","src":"/_astro/index.D-SOWjw7.css"},{"type":"external","src":"/_astro/index.CmkDfNhP.css"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"site":"https://ecomisto.org","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["\u0000astro:content",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/components/ActiveProjects.astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/components/home/Projects.astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/pages/index.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:src/pages/index@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astrojs-ssr-virtual-entry",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/components/projects/Projects.astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/pages/projects/index.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:src/pages/projects/index@_@astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/components/home/ArchiveProjects.astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/components/home/TeamMembers.astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/components/home/Team.astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/components/projects/ArchiveProjects.astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/pages/projects/[...slug].astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:src/pages/projects/[...slug]@_@astro",{"propagation":"in-tree","containsHead":false}],["/Volumes/Media HD/Web Development/ecomisto/src/pages/typography.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var i=t=>{let e=async()=>{await(await t())()};\"requestIdleCallback\"in window?window.requestIdleCallback(e):setTimeout(e,200)};(self.Astro||(self.Astro={})).idle=i;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var l=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let a of e)if(a.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=l;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astro-page:node_modules/.pnpm/astro@4.11.1_@types+node@20.12.11_typescript@5.5.2/node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/api/checkout@_@ts":"pages/api/checkout.astro.mjs","\u0000@astro-page:src/pages/api/liqpay-sendpulse@_@ts":"pages/api/liqpay-sendpulse.astro.mjs","\u0000@astro-page:src/pages/api/request-partnership@_@ts":"pages/api/request-partnership.astro.mjs","\u0000@astro-page:src/pages/projects/index@_@astro":"pages/projects.astro.mjs","\u0000@astro-page:src/pages/projects/[...slug]@_@astro":"pages/projects/_---slug_.astro.mjs","\u0000@astro-page:src/pages/typography@_@astro":"pages/typography.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000noop-middleware":"_noop-middleware.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-manifest":"manifest_DoH7kGGV.mjs","/Volumes/Media HD/Web Development/ecomisto/node_modules/.pnpm/@astrojs+react@3.6.0_@types+react-dom@18.2.19_@types+react@18.2.60_react-dom@18.2.0_react@18._uma5kdrvgy3kgdis6xse4lpeqe/node_modules/@astrojs/react/vnode-children.js":"chunks/vnode-children_C1YIWAGb.mjs","/node_modules/.pnpm/astro@4.11.1_@types+node@20.12.11_typescript@5.5.2/node_modules/astro/dist/assets/endpoint/generic.js":"chunks/generic_CdotYYLw.mjs","/src/pages/api/checkout.ts":"chunks/checkout_D2Rl6MtV.mjs","/src/pages/api/liqpay-sendpulse.ts":"chunks/liqpay-sendpulse_BihkKXsl.mjs","/src/pages/api/request-partnership.ts":"chunks/request-partnership_BbyQgJ_6.mjs","/src/pages/projects/index.astro":"chunks/index_DgzSLru2.mjs","/src/pages/projects/[...slug].astro":"chunks/_...slug__XHyWJMTk.mjs","/src/pages/typography.astro":"chunks/typography_DeNEob0N.mjs","/src/pages/index.astro":"chunks/index_Bw-Rp01s.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/city-makers.mdx?astroContentCollectionEntry=true":"chunks/city-makers_yfr9RLkg.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/maysternya-mista.mdx?astroContentCollectionEntry=true":"chunks/maysternya-mista_wvwIrX4C.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/peremoha-lab.mdx?astroContentCollectionEntry=true":"chunks/peremoha-lab_D5mz7Z3Z.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/plastic-fantastic.mdx?astroContentCollectionEntry=true":"chunks/plastic-fantastic_fck_ghya.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/prostir-diy.mdx?astroContentCollectionEntry=true":"chunks/prostir-diy_B_JPJ3AY.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/supersorters.mdx?astroContentCollectionEntry=true":"chunks/supersorters_CY6DLRtp.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/velokuhnya.mdx?astroContentCollectionEntry=true":"chunks/velokuhnya_CGrPHBtA.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/velolink.mdx?astroContentCollectionEntry=true":"chunks/velolink_BF1upu6c.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/andriy.yaml?astroDataCollectionEntry=true":"chunks/andriy_CAwNiP-E.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/daniil.yaml?astroDataCollectionEntry=true":"chunks/daniil_BZ_wG-es.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/evgen.yaml?astroDataCollectionEntry=true":"chunks/evgen_CT53sfir.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/maksym.yaml?astroDataCollectionEntry=true":"chunks/maksym_ciSOrGRI.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/natalya.yaml?astroDataCollectionEntry=true":"chunks/natalya_CKWVe0AA.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/oleksiy.yaml?astroDataCollectionEntry=true":"chunks/oleksiy_DJ0qJ0id.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/sergiy-bezborodko.yaml?astroDataCollectionEntry=true":"chunks/sergiy-bezborodko_4G_7GVnN.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/sergiy.yaml?astroDataCollectionEntry=true":"chunks/sergiy_Deg9RWhV.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/members/sonya.yaml?astroDataCollectionEntry=true":"chunks/sonya_DWUWGa2d.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/city-makers.mdx?astroPropagatedAssets":"chunks/city-makers_DRQEqhqD.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/maysternya-mista.mdx?astroPropagatedAssets":"chunks/maysternya-mista_HRJ7NKlu.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/peremoha-lab.mdx?astroPropagatedAssets":"chunks/peremoha-lab_DSIKaZB0.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/plastic-fantastic.mdx?astroPropagatedAssets":"chunks/plastic-fantastic_riZp954p.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/prostir-diy.mdx?astroPropagatedAssets":"chunks/prostir-diy_DAsLgQ4R.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/supersorters.mdx?astroPropagatedAssets":"chunks/supersorters_CqB8ZKaB.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/velokuhnya.mdx?astroPropagatedAssets":"chunks/velokuhnya_NsnST6F0.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/velolink.mdx?astroPropagatedAssets":"chunks/velolink_CvOXAF8k.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_001.jpg":"chunks/multiple_gallery_city-makers_001_CWkj1XtF.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_002.jpg":"chunks/multiple_gallery_city-makers_002_DRKK5U9d.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_003.jpg":"chunks/multiple_gallery_city-makers_003_92cqUxBg.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_004.jpg":"chunks/multiple_gallery_city-makers_004_BWOe9J-j.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_005.jpg":"chunks/multiple_gallery_city-makers_005_BDedn5RY.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_006.jpg":"chunks/multiple_gallery_city-makers_006_CG9LgQ2x.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_007.jpg":"chunks/multiple_gallery_city-makers_007_-8c56RxT.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_008.jpg":"chunks/multiple_gallery_city-makers_008_CCxC4m9t.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_009.jpg":"chunks/multiple_gallery_city-makers_009_D7-6unNf.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_010.jpg":"chunks/multiple_gallery_city-makers_010_1U2sIcFd.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/city-makers/multiple_gallery_city-makers_011.jpg":"chunks/multiple_gallery_city-makers_011_aXAO3RbB.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/multiple_gallery_plastic-equipment_001.jpg":"chunks/multiple_gallery_plastic-equipment_001_ONKYGz0K.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/multiple_gallery_plastic-equipment_002.jpg":"chunks/multiple_gallery_plastic-equipment_002_Bs41oBbw.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/multiple_gallery_plastic-equipment_003.jpg":"chunks/multiple_gallery_plastic-equipment_003_9d1ixRXk.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/multiple_gallery_plastic-equipment_004.jpg":"chunks/multiple_gallery_plastic-equipment_004_Bt1TDHBJ.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/multiple_gallery_plastic-equipment_005.jpg":"chunks/multiple_gallery_plastic-equipment_005_DuGbXvPG.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic-types.jpg":"chunks/plastic-types_BCij46uN.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_001.jpg":"chunks/plastic_fantastic_001_DnhFc_MN.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_002.jpg":"chunks/plastic_fantastic_002_CetdGmsZ.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_003.jpg":"chunks/plastic_fantastic_003_0mCMYyx4.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_004.jpg":"chunks/plastic_fantastic_004_CbSVlpGa.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_005.jpg":"chunks/plastic_fantastic_005_DxJlJZvP.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_006.jpg":"chunks/plastic_fantastic_006_DVJzOBcl.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_007.jpg":"chunks/plastic_fantastic_007_Bio08QgQ.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_008.jpg":"chunks/plastic_fantastic_008_CAcycicM.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_009.jpg":"chunks/plastic_fantastic_009_BaBiml2Z.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_010.jpg":"chunks/plastic_fantastic_010_hksTqHk4.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_011.jpg":"chunks/plastic_fantastic_011_dk-MBYQA.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_product_001.jpg":"chunks/plastic_fantastic_product_001_CC-f3c8J.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_product_002.jpg":"chunks/plastic_fantastic_product_002_BWMOpDXv.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_product_003.jpg":"chunks/plastic_fantastic_product_003_C-27Mlwq.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_product_004.jpg":"chunks/plastic_fantastic_product_004_Bv-Q1PPh.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/plastic-fantastic/plastic_fantastic_product_005.jpg":"chunks/plastic_fantastic_product_005_Dr336Gjv.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_001.jpg":"chunks/multiple_gallery_prostir-diy_001_Bx4zg6Yk.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_002.jpg":"chunks/multiple_gallery_prostir-diy_002_BH86Dm04.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_003.jpg":"chunks/multiple_gallery_prostir-diy_003_BZLhFM4G.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_004.jpg":"chunks/multiple_gallery_prostir-diy_004_BAOgVIyE.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_005.jpg":"chunks/multiple_gallery_prostir-diy_005_DknsKQ97.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_006.jpg":"chunks/multiple_gallery_prostir-diy_006_BCYhmYI9.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_007.jpg":"chunks/multiple_gallery_prostir-diy_007_BBzGObyh.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_008.jpg":"chunks/multiple_gallery_prostir-diy_008_BM0fWkDU.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_009.jpg":"chunks/multiple_gallery_prostir-diy_009_CVFQ7DN_.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_010.jpg":"chunks/multiple_gallery_prostir-diy_010_Bkn1DNws.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_011.jpg":"chunks/multiple_gallery_prostir-diy_011_IzRbjeme.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/multiple_gallery_prostir-diy_012.jpg":"chunks/multiple_gallery_prostir-diy_012_C8v9WNoO.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_001.jpg":"chunks/single_gallery_prostir-diy_001_C9k09Vfr.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_002.jpg":"chunks/single_gallery_prostir-diy_002_DmPIqtr_.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_003.jpg":"chunks/single_gallery_prostir-diy_003_DhlXcEGX.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_004.jpg":"chunks/single_gallery_prostir-diy_004_nmx8oxIE.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_005.jpg":"chunks/single_gallery_prostir-diy_005_CmGi4J1i.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_006.jpg":"chunks/single_gallery_prostir-diy_006_ZDG28jNE.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_007.jpg":"chunks/single_gallery_prostir-diy_007_D4pBVUfH.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_008.jpg":"chunks/single_gallery_prostir-diy_008_7hTCtcfP.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_009.jpg":"chunks/single_gallery_prostir-diy_009_B6k-6KkP.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_010.jpg":"chunks/single_gallery_prostir-diy_010_ClfEH9wE.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_011.jpg":"chunks/single_gallery_prostir-diy_011_C_hjVvFc.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_012.jpg":"chunks/single_gallery_prostir-diy_012_DxNQmvFn.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_013.jpg":"chunks/single_gallery_prostir-diy_013_xx2azsFZ.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_014.jpg":"chunks/single_gallery_prostir-diy_014_YyOARvmS.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_015.jpg":"chunks/single_gallery_prostir-diy_015_CAYC7O_B.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/prostir-diy/single_gallery_prostir-diy_016.jpg":"chunks/single_gallery_prostir-diy_016_i2Zl3uwm.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/gallery_supersorters_001.jpg":"chunks/gallery_supersorters_001_DN8_TjCO.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/gallery_supersorters_002.jpg":"chunks/gallery_supersorters_002_CpY0O00L.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/gallery_supersorters_003.jpg":"chunks/gallery_supersorters_003_DbeYmnPB.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/gallery_supersorters_004.jpg":"chunks/gallery_supersorters_004_8xvzQ5kd.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/gallery_supersorters_005.jpg":"chunks/gallery_supersorters_005_UbHSeQqd.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/gallery_supersorters_006.jpg":"chunks/gallery_supersorters_006_DZWwMN34.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/gallery_supersorters_007.jpg":"chunks/gallery_supersorters_007_DpKrfFQs.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/single_gallery_supersorters_001.jpg":"chunks/single_gallery_supersorters_001_CN6Ix-Cy.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/single_gallery_supersorters_002.jpg":"chunks/single_gallery_supersorters_002_s2a51Yt0.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/single_gallery_supersorters_003.jpg":"chunks/single_gallery_supersorters_003_BJVQR7AA.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/single_gallery_supersorters_004.jpg":"chunks/single_gallery_supersorters_004_HpwWBro3.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/supersorters/single_gallery_supersorters_005.jpg":"chunks/single_gallery_supersorters_005_BpyZA23X.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/tolocar_021.jpg":"chunks/tolocar_021_Bt5z7KaJ.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_001.jpg":"chunks/gallery_velolink_001_D0G2zVbj.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_002.jpg":"chunks/gallery_velolink_002_DBDZysfp.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_003.jpg":"chunks/gallery_velolink_003_Cv1w1ksc.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_004.jpg":"chunks/gallery_velolink_004_CY3ToIpy.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_005.jpg":"chunks/gallery_velolink_005_BCIxhfwM.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_006.jpg":"chunks/gallery_velolink_006_JYmVMeZP.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_007.jpg":"chunks/gallery_velolink_007_BDhGMQAn.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_008.jpg":"chunks/gallery_velolink_008_Cbt1ZXVk.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_009.jpg":"chunks/gallery_velolink_009_nwVaOEew.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_010.jpg":"chunks/gallery_velolink_010_Cwn24Qs_.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_011.jpg":"chunks/gallery_velolink_011_BJNn72Qt.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/images/velolink/gallery_velolink_012.jpg":"chunks/gallery_velolink_012_BikzqMKu.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/city-makers.mdx":"chunks/city-makers_-O3FkPhl.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/maysternya-mista.mdx":"chunks/maysternya-mista_DdK3Fd7x.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/peremoha-lab.mdx":"chunks/peremoha-lab_6dsiF9Fx.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/plastic-fantastic.mdx":"chunks/plastic-fantastic_MjSmqHku.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/prostir-diy.mdx":"chunks/prostir-diy_Bz_eOOuC.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/supersorters.mdx":"chunks/supersorters_fnOx7NeM.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/velokuhnya.mdx":"chunks/velokuhnya_CDMC9Ahk.mjs","/Volumes/Media HD/Web Development/ecomisto/src/content/projects/velolink.mdx":"chunks/velolink_DyKyDezE.mjs","/astro/hoisted.js?q=2":"_astro/hoisted.OEP79HHN.js","/astro/hoisted.js?q=0":"_astro/hoisted.6BXvnG-P.js","/astro/hoisted.js?q=3":"_astro/hoisted.B7Uy0sag.js","@astrojs/react/client.js":"_astro/client.DeRgRf24.js","/astro/hoisted.js?q=1":"_astro/hoisted.DIOs2ChU.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/hero.DFoWXZAk.jpg","/_astro/multiple_gallery_city-makers_001.DCdzKVz9.jpg","/_astro/gallery_supersorters_001.DoCriRfX.jpg","/_astro/multiple_gallery_prostir-diy_001.B06nVs8y.jpg","/_astro/sergiy-b.Dg-guVmX.png","/_astro/achievments-bg-final.CgPE6Tpw.jpg","/_astro/sergiy.Dg0I7MF3.png","/_astro/natalya.ITnnDtAk.png","/_astro/sonya.ee0md45t.png","/_astro/andriy.BgaLT4nQ.png","/_astro/evgen.Dw5pguzD.png","/_astro/daniil.D4-A-VVV.png","/_astro/oleksiy.oCK4N9QG.png","/_astro/maksym.BcRDB4lu.png","/_astro/multiple_gallery_city-makers_002.BRs4vBxO.jpg","/_astro/multiple_gallery_city-makers_003.5iv4Fwz6.jpg","/_astro/multiple_gallery_city-makers_004.DHvQ08PJ.jpg","/_astro/multiple_gallery_city-makers_005.cBCZYaJZ.jpg","/_astro/multiple_gallery_city-makers_006.DtKtP5O3.jpg","/_astro/cover_peremoha-lab.BsxZrR-Q.png","/_astro/multiple_gallery_city-makers_007.B_I9mbjM.jpg","/_astro/multiple_gallery_city-makers_008.Cth7ab0a.jpg","/_astro/gallery_velolink_001.BpklnhA9.jpg","/_astro/multiple_gallery_city-makers_009.gkvGDDyk.jpg","/_astro/multiple_gallery_city-makers_011.wAZSzwPH.jpg","/_astro/multiple_gallery_plastic-equipment_001.BfqbXHFp.jpg","/_astro/multiple_gallery_plastic-equipment_002.CyHK0UAV.jpg","/_astro/multiple_gallery_plastic-equipment_003.CfhbBzAW.jpg","/_astro/multiple_gallery_plastic-equipment_004.BIJncN_j.jpg","/_astro/plastic_fantastic_001.DKUDYnMy.jpg","/_astro/plastic-types.Buq8o9GF.jpg","/_astro/multiple_gallery_city-makers_010.BngxG-BE.jpg","/_astro/multiple_gallery_plastic-equipment_005.BRj5K_-h.jpg","/_astro/cover_plastic-fantastic-2.CpGR91g2.png","/_astro/cover_maysternya-mista.C_Y7zd1u.png","/_astro/cover_velokuhnya.BTpkGKCv.png","/_astro/plastic_fantastic_003.H9vGROW_.jpg","/_astro/plastic_fantastic_004.BRaLx1b1.jpg","/_astro/plastic_fantastic_005.BWVnuzpj.jpg","/_astro/plastic_fantastic_007.vZX3TEY8.jpg","/_astro/plastic_fantastic_002.mYhid6s0.jpg","/_astro/plastic_fantastic_009.BAYbxh0_.jpg","/_astro/plastic_fantastic_006.trGPGOHe.jpg","/_astro/plastic_fantastic_008.DgfFKiKI.jpg","/_astro/plastic_fantastic_010.BWSxDfNw.jpg","/_astro/plastic_fantastic_011.DxSWXq1M.jpg","/_astro/plastic_fantastic_product_002.D2xNczjF.jpg","/_astro/plastic_fantastic_product_003.ZpSpNe48.jpg","/_astro/plastic_fantastic_product_004.DhvNaQeD.jpg","/_astro/plastic_fantastic_product_005.Cc4GBDp1.jpg","/_astro/plastic_fantastic_product_001.oy5OHghy.jpg","/_astro/multiple_gallery_prostir-diy_002.Dsklubef.jpg","/_astro/multiple_gallery_prostir-diy_003.Df4VdGVO.jpg","/_astro/multiple_gallery_prostir-diy_004.12lMX4eF.jpg","/_astro/multiple_gallery_prostir-diy_007.Cb2Se-r2.jpg","/_astro/multiple_gallery_prostir-diy_009.DTXBKHkl.jpg","/_astro/single_gallery_prostir-diy_002.Cw0nW6F4.jpg","/_astro/multiple_gallery_prostir-diy_005.EAAk-s3W.jpg","/_astro/multiple_gallery_prostir-diy_008.SHxK4VFD.jpg","/_astro/multiple_gallery_prostir-diy_012.Bk1Njkh0.jpg","/_astro/multiple_gallery_prostir-diy_011.CpJZxIlS.jpg","/_astro/single_gallery_prostir-diy_001.CJApugEE.jpg","/_astro/multiple_gallery_prostir-diy_006.BzqHe_f7.jpg","/_astro/multiple_gallery_prostir-diy_010.BKoU3UgX.jpg","/_astro/single_gallery_prostir-diy_007.cW5S8URH.jpg","/_astro/single_gallery_prostir-diy_003.BibMmN10.jpg","/_astro/single_gallery_prostir-diy_005.KuKW3yKo.jpg","/_astro/single_gallery_prostir-diy_006.DB8kfyDi.jpg","/_astro/single_gallery_prostir-diy_009.DD9VZHrc.jpg","/_astro/single_gallery_prostir-diy_004.Dt_ECK9J.jpg","/_astro/single_gallery_prostir-diy_010.BegFfsJA.jpg","/_astro/single_gallery_prostir-diy_011.si9RzfyP.jpg","/_astro/single_gallery_prostir-diy_014.NrXnm5Rg.jpg","/_astro/single_gallery_prostir-diy_013.vd9E_Is_.jpg","/_astro/single_gallery_prostir-diy_012.CNuUMfVt.jpg","/_astro/gallery_supersorters_002.C0_iI_5r.jpg","/_astro/gallery_supersorters_003.BjInibAV.jpg","/_astro/gallery_supersorters_004.BJ76cVSM.jpg","/_astro/gallery_supersorters_006.WFzaluoq.jpg","/_astro/single_gallery_prostir-diy_008.Bg8lFKJ6.jpg","/_astro/single_gallery_prostir-diy_015.CwdMkjai.jpg","/_astro/single_gallery_prostir-diy_016.DIDl1ngO.jpg","/_astro/gallery_supersorters_005.vibT24jO.jpg","/_astro/tolocar_021.t6ikNM5Z.jpg","/_astro/gallery_supersorters_007.nc-GK53l.jpg","/_astro/gallery_velolink_002.Dcl9oKcX.jpg","/_astro/gallery_velolink_003.D0TqKG-r.jpg","/_astro/gallery_velolink_004.BRI5mF9U.jpg","/_astro/gallery_velolink_012.Dy8YOE-q.jpg","/_astro/gallery_velolink_005.DOoB0hAR.jpg","/_astro/gallery_velolink_006.3CKBBDFG.jpg","/_astro/gallery_velolink_010.Bo5Ac0Hg.jpg","/_astro/gallery_velolink_007.DTgFt_ir.jpg","/_astro/gallery_velolink_011.CRG3QG5q.jpg","/_astro/gallery_velolink_009.DodvUT4P.jpg","/_astro/gallery_velolink_008.Dgyvg3-3.jpg","/_astro/single_gallery_supersorters_001.BbsXwCbh.jpg","/_astro/single_gallery_supersorters_002.DAin3SGa.jpg","/_astro/single_gallery_supersorters_003.DnYuhe6j.jpg","/_astro/single_gallery_supersorters_004.D6n1shG6.jpg","/_astro/single_gallery_supersorters_005.DoJkzwyQ.jpg","/_astro/_slug_.Cn4jDhbk.css","/_astro/index.D-SOWjw7.css","/_astro/index.CLF_GW0n.css","/_astro/index.sZqD5BbP.css","/_astro/index.CmkDfNhP.css","/ecomisto-showreel.mp4","/favicon.svg","/sprite.svg","/_astro/client.DeRgRf24.js","/_astro/hoisted.6BXvnG-P.js","/_astro/hoisted.B7Uy0sag.js","/_astro/hoisted.CCRaorum.css","/_astro/hoisted.DIOs2ChU.js","/_astro/hoisted.OEP79HHN.js","/fonts/Ermilov-Bold.woff","/fonts/Mariupol-Bold.woff","/fonts/Mariupol-Medium.woff","/fonts/Mariupol-Regular.woff","/fonts/MariupolSymbols.woff","/projects/index.html","/typography/index.html"],"buildFormat":"directory","checkOrigin":false,"rewritingEnabled":false,"experimentalEnvGetSecretEnabled":false});

export { manifest };
