#!/usr/bin/env python3
"""
统计代码库中各种文件类型的行数，并生成Plotly可视化
"""
import os
import json
from pathlib import Path
from collections import defaultdict

# 定义代码文件扩展名和对应的类型名称
CODE_EXTENSIONS = {
    '.py': 'Python',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript React',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript React',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.sh': 'Shell Script',
    '.css': 'CSS',
    '.html': 'HTML',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.config.js': 'Config JS',
    '.config.ts': 'Config TS',
}

# 需要排除的目录
EXCLUDE_DIRS = {
    'node_modules',
    'venv',
    '__pycache__',
    '.git',
    'dist',
    'build',
    '.next',
    '.vscode',
    '.idea',
}


def should_exclude_path(path: Path) -> bool:
    """检查路径是否应该被排除"""
    parts = path.parts
    for exclude_dir in EXCLUDE_DIRS:
        if exclude_dir in parts:
            return True
    return False


def get_file_type(file_path: Path) -> str:
    """根据文件路径和扩展名确定文件类型"""
    name = file_path.name.lower()
    
    # 特殊处理配置文件
    if name.endswith('.config.js'):
        return 'Config JS'
    if name.endswith('.config.ts'):
        return 'Config TS'
    
    suffix = file_path.suffix.lower()
    return CODE_EXTENSIONS.get(suffix, 'Other')


def count_lines(file_path: Path) -> int:
    """统计文件行数"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for _ in f)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return 0


def analyze_codebase(root_dir: Path) -> dict:
    """分析代码库，返回统计信息"""
    stats = defaultdict(lambda: {'lines': 0, 'files': 0, 'file_list': []})
    
    for file_path in root_dir.rglob('*'):
        if file_path.is_file():
            if should_exclude_path(file_path):
                continue
            
            file_type = get_file_type(file_path)
            if file_type == 'Other':
                continue
            
            lines = count_lines(file_path)
            if lines > 0:
                stats[file_type]['lines'] += lines
                stats[file_type]['files'] += 1
                stats[file_type]['file_list'].append({
                    'path': str(file_path.relative_to(root_dir)),
                    'lines': lines
                })
    
    return dict(stats)


def generate_html_visualization(stats: dict, output_path: Path):
    """生成Plotly可视化HTML"""
    
    # 准备数据
    file_types = list(stats.keys())
    lines_data = [stats[ft]['lines'] for ft in file_types]
    files_data = [stats[ft]['files'] for ft in file_types]
    
    # 按行数排序
    sorted_indices = sorted(range(len(file_types)), key=lambda i: lines_data[i], reverse=True)
    file_types = [file_types[i] for i in sorted_indices]
    lines_data = [lines_data[i] for i in sorted_indices]
    files_data = [files_data[i] for i in sorted_indices]
    
    total_lines = sum(lines_data)
    total_files = sum(files_data)
    
    html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>代码库统计可视化</title>
    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            padding: 30px;
        }}
        h1 {{
            text-align: center;
            color: #333;
            margin-bottom: 10px;
        }}
        .summary {{
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 8px;
            color: white;
        }}
        .summary h2 {{
            margin: 10px 0;
            font-size: 2.5em;
        }}
        .summary p {{
            margin: 5px 0;
            font-size: 1.2em;
            opacity: 0.9;
        }}
        .charts-container {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 30px;
        }}
        .chart-box {{
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
        }}
        .chart-title {{
            text-align: center;
            font-size: 1.3em;
            font-weight: bold;
            margin-bottom: 15px;
            color: #333;
        }}
        .stats-table {{
            width: 100%;
            margin-top: 30px;
            border-collapse: collapse;
        }}
        .stats-table th, .stats-table td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        .stats-table th {{
            background: #667eea;
            color: white;
            font-weight: bold;
        }}
        .stats-table tr:hover {{
            background: #f5f5f5;
        }}
        @media (max-width: 768px) {{
            .charts-container {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 代码库统计报告</h1>
        
        <div class="summary">
            <h2>{total_lines:,} 行</h2>
            <p>总计 {total_files} 个代码文件</p>
            <p>{len(file_types)} 种文件类型</p>
        </div>
        
        <div class="charts-container">
            <div class="chart-box">
                <div class="chart-title">按文件类型统计 - 行数</div>
                <div id="linesChart"></div>
            </div>
            
            <div class="chart-box">
                <div class="chart-title">按文件类型统计 - 文件数</div>
                <div id="filesChart"></div>
            </div>
        </div>
        
        <table class="stats-table">
            <thead>
                <tr>
                    <th>文件类型</th>
                    <th>文件数</th>
                    <th>总行数</th>
                    <th>平均行数</th>
                    <th>占比</th>
                </tr>
            </thead>
            <tbody>
"""
    
    # 添加表格行
    for i, file_type in enumerate(file_types):
        lines = lines_data[i]
        files = files_data[i]
        avg_lines = lines // files if files > 0 else 0
        percentage = (lines / total_lines * 100) if total_lines > 0 else 0
        
        html_content += f"""                <tr>
                    <td>{file_type}</td>
                    <td>{files}</td>
                    <td>{lines:,}</td>
                    <td>{avg_lines:,}</td>
                    <td>{percentage:.1f}%</td>
                </tr>
"""
    
    html_content += """            </tbody>
        </table>
    </div>
    
    <script>
        // 数据
        const fileTypes = """ + json.dumps(file_types, ensure_ascii=False) + """;
        const linesData = """ + json.dumps(lines_data, ensure_ascii=False) + """;
        const filesData = """ + json.dumps(files_data, ensure_ascii=False) + """;
        
        // 行数饼图
        const linesTrace = {
            labels: fileTypes,
            values: linesData,
            type: 'pie',
            hole: 0.4,
            textinfo: 'label+percent',
            textposition: 'outside',
            marker: {
                colors: [
                    '#667eea', '#764ba2', '#f093fb', '#4facfe', 
                    '#00f2fe', '#43e97b', '#fa709a', '#fee140',
                    '#30cfd0', '#330867', '#a8edea', '#fed6e3'
                ]
            }
        };
        
        const linesLayout = {
            margin: { t: 20, b: 20, l: 20, r: 20 },
            showlegend: false,
            font: { size: 12 }
        };
        
        Plotly.newPlot('linesChart', [linesTrace], linesLayout, {{responsive: true}});
        
        // 文件数柱状图
        const filesTrace = {
            x: fileTypes,
            y: filesData,
            type: 'bar',
            marker: {
                color: filesData,
                colorscale: 'Viridis',
                showscale: true
            },
            text: filesData,
            textposition: 'outside'
        };
        
        const filesLayout = {
            title: '',
            xaxis: { title: '文件类型' },
            yaxis: { title: '文件数量' },
            margin: { t: 20, b: 60, l: 60, r: 20 },
            font: { size: 12 }
        };
        
        Plotly.newPlot('filesChart', [filesTrace], filesLayout, {{responsive: true}});
    </script>
</body>
</html>"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"✅ 可视化HTML已生成: {output_path}")


def main():
    root_dir = Path(__file__).parent
    output_path = root_dir / 'code_stats_visualization.html'
    
    print("🔍 正在分析代码库...")
    stats = analyze_codebase(root_dir)
    
    print(f"\n📊 统计结果:")
    print(f"{'='*60}")
    print(f"{'文件类型':<20} {'文件数':<10} {'总行数':<15} {'平均行数':<15}")
    print(f"{'='*60}")
    
    total_lines = 0
    total_files = 0
    
    # 按行数排序并打印
    sorted_stats = sorted(stats.items(), key=lambda x: x[1]['lines'], reverse=True)
    
    for file_type, data in sorted_stats:
        lines = data['lines']
        files = data['files']
        avg_lines = lines // files if files > 0 else 0
        total_lines += lines
        total_files += files
        print(f"{file_type:<20} {files:<10} {lines:<15,} {avg_lines:<15,}")
    
    print(f"{'='*60}")
    print(f"{'总计':<20} {total_files:<10} {total_lines:<15,}")
    print(f"\n共 {len(stats)} 种文件类型")
    
    print("\n🎨 正在生成可视化...")
    generate_html_visualization(stats, output_path)
    
    print(f"\n✨ 完成！打开 {output_path} 查看可视化结果")


if __name__ == '__main__':
    main()

