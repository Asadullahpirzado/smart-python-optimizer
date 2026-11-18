"""Downloads Chart.js and Cytoscape.js into frontend/static/js/vendor so the UI works without CDN access.
Run once:  python download_libs.py   (then refresh the browser with Ctrl+F5)"""
import os
import urllib.request

DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "static", "js", "vendor")
FILES = {
    "chart.umd.min.js": ["https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
                         "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js",
                         "https://unpkg.com/chart.js@4.4.0/dist/chart.umd.min.js"],
    "cytoscape.min.js": ["https://cdn.jsdelivr.net/npm/cytoscape@3.28.1/dist/cytoscape.min.js",
                         "https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js",
                         "https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"],
}
os.makedirs(DEST, exist_ok=True)
for name, urls in FILES.items():
    for url in urls:
        try:
            data = urllib.request.urlopen(url, timeout=30).read()
            if len(data) > 50000:
                open(os.path.join(DEST, name), "wb").write(data)
                print("OK  ", name, "from", url)
                break
        except Exception as exc:
            print("fail", url, "-", exc)
    else:
        print("COULD NOT DOWNLOAD", name, "- download it manually from one of:", *urls, sep="\n   ")
