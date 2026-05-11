"""akshare bridge: fetch fund NAV data, output JSON to stdout.
Usage: python3 akshare_bridge.py 000619 002920 ...
or:    echo '["000619","002920"]' | python3 akshare_bridge.py --stdin
"""
import sys, json, warnings
warnings.filterwarnings('ignore')

def fetch_funds(codes):
    import akshare as ak
    results = {}
    for code in codes:
        try:
            df = ak.fund_open_fund_info_em(symbol=code, indicator='单位净值走势')
            if len(df) > 0:
                latest = df.iloc[-1]
                results[code] = {
                    'date': str(latest['净值日期']),
                    'nav': float(latest['单位净值']),
                    'change_pct': float(latest['日增长率']),
                }
        except Exception:
            pass
    return results

if __name__ == '__main__':
    if '--stdin' in sys.argv:
        codes = json.load(sys.stdin)
    else:
        codes = sys.argv[1:]
    if not codes:
        print(json.dumps({}))
        sys.exit(0)
    results = fetch_funds(codes)
    print(json.dumps(results, ensure_ascii=False))
