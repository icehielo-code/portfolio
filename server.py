import http.server
import json
import re
import time
import urllib.request
import urllib.error
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path.startswith('/api/fund?'):
            self.handle_fund_proxy()
        else:
            super().do_GET()

    def handle_fund_proxy(self):
        from urllib.parse import urlparse, parse_qs
        qs = parse_qs(urlparse(self.path).query)
        code = (qs.get('code', [''])[0] or '').strip()

        if not code or len(code) != 6 or not code.isdigit():
            self.send_json({'error': '无效基金代码'}, 400)
            return

        result = self.try_tiantian(code)
        if result and result.get('name'):
            result['source'] = '天天基金'
            self.send_json(result)
            return

        result = self.try_eastmoney_detail(code)
        if result and result.get('name'):
            result['source'] = '东方财富'
            self.send_json(result)
            return

        result = self.try_sina(code)
        if result and result.get('name'):
            result['source'] = '新浪财经'
            self.send_json(result)
            return

        self.send_json({'error': '所有接口均失败'}, 502)

    @staticmethod
    def _fetch(url, headers=None, timeout=8, encoding='utf-8'):
        hdrs = {'User-Agent': UA}
        if headers:
            hdrs.update(headers)
        req = urllib.request.Request(url, headers=hdrs)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_bytes = resp.read()
            if encoding == 'gbk':
                return raw_bytes.decode('gbk', errors='replace')
            return raw_bytes.decode('utf-8', errors='replace')

    @staticmethod
    def try_tiantian(code):
        try:
            raw = ProxyHandler._fetch(
                f'https://fundgz.1234567.com.cn/js/{code}.js?rt={int(time.time()*1000)}',
                headers={'Referer': 'https://fund.eastmoney.com/'}
            )
            m = re.search(r'\((\{.*?\})\)', raw, re.DOTALL)
            if not m:
                return None
            obj = json.loads(m.group(1))
            if not obj.get('name'):
                return None
            return {
                'name': obj.get('name', ''),
                'nav': obj.get('dwjz'),
                'gsz': obj.get('gsz'),
                'gszzl': obj.get('gszzl'),
                'dwjz': obj.get('dwjz'),
                'jzrq': obj.get('jzrq', ''),
            }
        except Exception as e:
            print(f'  天天基金失败: {e}')
            return None

    @staticmethod
    def try_eastmoney_detail(code):
        try:
            raw = ProxyHandler._fetch(
                f'https://fund.eastmoney.com/pingzhongdata/{code}.js',
                headers={'Referer': 'https://fund.eastmoney.com/'}
            )
            name_m = re.search(r'var\s+fS_name\s*=\s*"([^"]+)"', raw)
            if not name_m:
                return None

            name = name_m.group(1)
            dwjz = None
            jzrq = ''

            ishb_m = re.search(r'var\s+ishb\s*=\s*(true|false)', raw)
            ishb = ishb_m and ishb_m.group(1) == 'true'

            if ishb:
                income_m = re.search(r'var\s+Data_millionCopiesIncome\s*=\s*(\[.*?\]);', raw, re.DOTALL)
                if income_m:
                    try:
                        arr = json.loads(income_m.group(1))
                        if arr:
                            last = arr[-1]
                            dwjz = '1.0000'
                            ts = last[0] if isinstance(last, list) and len(last) > 0 else 0
                            if ts:
                                jzrq = time.strftime('%Y-%m-%d', time.localtime(ts / 1000))
                    except (json.JSONDecodeError, IndexError):
                        pass
                result = {
                    'name': name,
                    'nav': dwjz or '1.0000',
                    'dwjz': dwjz or '1.0000',
                    'jzrq': jzrq,
                    'type_hint': '货币基金',
                }
            else:
                nav_m = re.search(r'var\s+Data_netWorthTrend\s*=\s*(\[.*?\]);', raw, re.DOTALL)
                if nav_m:
                    try:
                        arr = json.loads(nav_m.group(1))
                        if arr:
                            last = arr[-1]
                            dwjz = str(last.get('y', ''))
                            ts = last.get('x', 0)
                            if ts:
                                jzrq = time.strftime('%Y-%m-%d', time.localtime(ts / 1000))
                    except (json.JSONDecodeError, IndexError):
                        pass
                result = {
                    'name': name,
                    'dwjz': dwjz,
                    'jzrq': jzrq,
                }
                if dwjz:
                    result['nav'] = dwjz

            syl_1n_m = re.search(r'var\s+syl_1n\s*=\s*"([^"]*)"', raw)
            if syl_1n_m and syl_1n_m.group(1):
                result['syl_1n'] = syl_1n_m.group(1)

            return result
        except Exception as e:
            print(f'  东方财富详情失败: {e}')
            return None

    @staticmethod
    def try_sina(code):
        try:
            raw = ProxyHandler._fetch(
                f'https://hq.sinajs.cn/list=f_{code}',
                headers={'Referer': 'https://finance.sina.com.cn/'},
                encoding='gbk'
            )
            var_name = f'hq_str_f_{code}'
            m = re.search(r'var\s+' + re.escape(var_name) + r'="([^"]*)"', raw)
            if not m or not m.group(1):
                return None
            parts = m.group(1).split(',')
            if len(parts) < 2 or not parts[0]:
                return None
            return {
                'name': parts[0],
                'nav': parts[1] if len(parts) > 1 and parts[1] else (parts[2] if len(parts) > 2 else ''),
            }
        except Exception as e:
            print(f'  新浪财经失败: {e}')
            return None

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        msg = format % args
        if '/api/fund' in msg or args[1] != '200':
            super().log_message(format, *args)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    with http.server.HTTPServer(('', port), ProxyHandler) as httpd:
        print(f'服务器启动: http://localhost:{port}')
        print(f'  静态文件: 当前目录')
        print(f'  基金代理: /api/fund?code=XXXXXX')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n服务器已停止')
