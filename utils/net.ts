// Copyright 2020 the Deno authors. All rights reserved. MIT license.

export function ip4ToInt(ip: string) {
  const octs_ = ip.split(".");
  if (octs_.length !== 4) throw new Error(`Invalid IP address ${ip}`);
  const oct = octs_.map((oct_) => {
    const oct = parseInt(oct_, 10);
    if (oct > 255 || oct < 0) throw new Error(`Invalid IP address ${ip}`);
    return oct;
  });
  return oct.reduce(
    (int, oct) => (int << 8) + oct,
    0,
  ) >>> 0;
}

export function isIp4InCidr(ip: string) {
  return (cidr: string) => {
    const [range, bits = "32"] = cidr.split("/");
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
    return (ip4ToInt(ip) & mask) === (ip4ToInt(range) & mask);
  };
}

export function isIp4InCidrs(ip: string, cidrs: string[]) {
  return cidrs.some(isIp4InCidr(ip));
}
