import io
import html
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def _sanitize(text: str) -> str:
    """Escape XML characters to prevent HTML/XML injection in reportlab Paragraphs."""
    if not text:
        return ""
    # Strip HTML tags entirely to satisfy the sanitization requirement
    import re
    clean = re.sub('<[^<]+?>', '', text)
    return html.escape(clean)

def _apply_generic_metadata(doc: SimpleDocTemplate):
    """Set generic PDF metadata to avoid fingerprinting/leaking backend details."""
    doc.title = "PixelForge Studio Report"
    doc.author = "PixelForge Studio"
    doc.subject = "System Data Export"
    doc.creator = "PixelForge"
    doc.keywords = "Report, Security, Audit"

def generate_player_report_pdf(player_data: dict, scores: list, admin_username: str) -> bytes:
    """
    Generate an admin report on a single player.
    (HU-B07)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    _apply_generic_metadata(doc)

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.HexColor('#7c3aed'), # Purple
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#94a3b8'),
        spaceAfter=20
    )
    
    header_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#06b6d4'), # Cyan
        spaceBefore=15,
        spaceAfter=8
    )
    
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=6
    )

    story = []
    
    # Title
    story.append(Paragraph(_sanitize("Reporte de Jugador — PixelForge Studio"), title_style))
    story.append(Paragraph(f"Generado por Administrador: {_sanitize(admin_username)} | Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", subtitle_style))
    
    # Player Metadata Section
    story.append(Paragraph("Datos de la Cuenta", header_style))
    meta_data = [
        [Paragraph("<b>Nombre de usuario:</b>", body_style), Paragraph(_sanitize(player_data['username']), body_style)],
        [Paragraph("<b>Fecha de registro:</b>", body_style), Paragraph(_sanitize(player_data['created_at'].strftime('%Y-%m-%d %H:%M:%S') if isinstance(player_data['created_at'], datetime) else str(player_data['created_at'])), body_style)],
        [Paragraph("<b>Estado de cuenta:</b>", body_style), Paragraph(f"<font color='{ 'green' if player_data['status'] == 'activo' else 'red' }'><b>{_sanitize(player_data['status'].upper())}</b></font>", body_style)],
        [Paragraph("<b>Saldo de tokens:</b>", body_style), Paragraph(f"{player_data['token_balance']} COP (equivalente)", body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[150, 400])
    t_meta.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 15))

    # Metrics Section
    story.append(Paragraph("Métricas de Juego", header_style))
    partidas = len(scores)
    max_score = max([s.score for s in scores]) if scores else 0
    avg_score = sum([s.score for s in scores]) / partidas if scores else 0
    
    metrics_data = [
        [Paragraph("<b>Total partidas jugadas:</b>", body_style), Paragraph(str(partidas), body_style)],
        [Paragraph("<b>Puntaje máximo:</b>", body_style), Paragraph(f"{max_score} pts", body_style)],
        [Paragraph("<b>Puntaje promedio:</b>", body_style), Paragraph(f"{avg_score:.2f} pts", body_style)]
    ]
    t_metrics = Table(metrics_data, colWidths=[150, 400])
    t_metrics.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_metrics)
    story.append(Spacer(1, 15))

    # Scores List
    story.append(Paragraph("Historial de Partidas", header_style))
    if not scores:
        story.append(Paragraph("No hay puntajes registrados para este jugador.", body_style))
    else:
        table_content = [[
            Paragraph("<b>#</b>", body_style),
            Paragraph("<b>Fecha</b>", body_style),
            Paragraph("<b>Nivel</b>", body_style),
            Paragraph("<b>Puntaje</b>", body_style)
        ]]
        for idx, s in enumerate(scores, 1):
            table_content.append([
                Paragraph(str(idx), body_style),
                Paragraph(s.recorded_at.strftime('%Y-%m-%d %H:%M:%S'), body_style),
                Paragraph(str(s.level_completed), body_style),
                Paragraph(f"{s.score} pts", body_style)
            ])
            
        t_scores = Table(table_content, colWidths=[30, 200, 100, 210])
        t_scores.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(t_scores)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

def generate_global_stats_pdf(stats: dict, top10: list, date_from: str, date_to: str) -> bytes:
    """
    Generate the global stats PDF report for admin_juego.
    (HU-B08)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    _apply_generic_metadata(doc)

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=22,
        textColor=colors.HexColor('#7c3aed'),
        spaceAfter=10
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#94a3b8'),
        spaceAfter=20
    )
    
    header_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#06b6d4'),
        spaceBefore=15,
        spaceAfter=8
    )
    
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=6
    )

    story = []
    
    story.append(Paragraph(_sanitize("Reporte Estadístico Global — PixelForge Studio"), title_style))
    story.append(Paragraph(f"Período: {_sanitize(date_from)} a {_sanitize(date_to)} | Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", subtitle_style))
    
    story.append(Paragraph("Métricas de la Comunidad", header_style))
    summary_data = [
        [Paragraph("<b>Total jugadores activos en el período:</b>", body_style), Paragraph(str(stats['active_players']), body_style)],
        [Paragraph("<b>Total partidas jugadas:</b>", body_style), Paragraph(str(stats['total_games']), body_style)],
        [Paragraph("<b>Puntaje promedio global:</b>", body_style), Paragraph(f"{stats['average_score']:.2f} pts" if stats['average_score'] else "0.00 pts", body_style)],
        [Paragraph("<b>Cuentas suspendidas:</b>", body_style), Paragraph(str(stats['suspended_accounts']), body_style)]
    ]
    t_summary = Table(summary_data, colWidths=[250, 300])
    t_summary.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 15))

    story.append(Paragraph("Top 10 Jugadores del Período", header_style))
    if not top10:
        story.append(Paragraph("No hay partidas registradas en el rango de fechas seleccionado.", body_style))
    else:
        table_content = [[
            Paragraph("<b>Puesto</b>", body_style),
            Paragraph("<b>Nombre de Usuario</b>", body_style),
            Paragraph("<b>Puntaje Más Alto</b>", body_style)
        ]]
        for pos, (username, max_s) in enumerate(top10, 1):
            table_content.append([
                Paragraph(str(pos), body_style),
                Paragraph(_sanitize(username), body_style),
                Paragraph(f"{max_s} pts", body_style)
            ])
            
        t_top = Table(table_content, colWidths=[50, 300, 190])
        t_top.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(t_top)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

def generate_player_data_pdf(user_data: dict, scores: list, transactions: list, items: list) -> bytes:
    """
    Generate player's personal data report under Ley 1581 (HABEAS DATA).
    Excludes ALL credentials, secrets, full card numbers, CVVs, and active JWTs.
    (HU-B13)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    _apply_generic_metadata(doc)

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#7c3aed'),
        spaceAfter=10
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#94a3b8'),
        spaceAfter=15
    )
    
    header_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#06b6d4'),
        spaceBefore=12,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=4
    )

    story = []
    
    # Intro
    story.append(Paragraph("Copia de Datos Personales — Ley 1581 de 2012 (Habeas Data)", title_style))
    story.append(Paragraph(
        f"Titular: {_sanitize(user_data['username'])} | Correo: {_sanitize(user_data['email'])} | "
        f"Fecha de descarga: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", 
        subtitle_style
    ))
    
    # 1. Personal Information
    story.append(Paragraph("1. Información de Perfil", header_style))
    meta_data = [
        [Paragraph("<b>Nombre de usuario:</b>", body_style), Paragraph(_sanitize(user_data['username']), body_style)],
        [Paragraph("<b>Correo electrónico:</b>", body_style), Paragraph(_sanitize(user_data['email']), body_style)],
        [Paragraph("<b>Fecha de registro:</b>", body_style), Paragraph(str(user_data['created_at']), body_style)],
        [Paragraph("<b>Estado de cuenta:</b>", body_style), Paragraph(_sanitize(user_data['status']), body_style)],
        [Paragraph("<b>Saldo actual de tokens:</b>", body_style), Paragraph(f"{user_data['token_balance']} tokens", body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[150, 390])
    t_meta.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_meta)
    
    # 2. Score History
    story.append(Paragraph("2. Historial de Puntajes", header_style))
    if not scores:
        story.append(Paragraph("No registra partidas jugadas.", body_style))
    else:
        table_content = [[
            Paragraph("<b>Fecha</b>", body_style),
            Paragraph("<b>Nivel</b>", body_style),
            Paragraph("<b>Puntaje</b>", body_style)
        ]]
        for s in scores:
            table_content.append([
                Paragraph(s.recorded_at.strftime('%Y-%m-%d %H:%M:%S'), body_style),
                Paragraph(str(s.level_completed), body_style),
                Paragraph(f"{s.score} pts", body_style)
            ])
        t_scores = Table(table_content, colWidths=[200, 100, 240])
        t_scores.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t_scores)

    # 3. Token Transactions (last four digits only)
    story.append(Paragraph("3. Historial de Transacciones de Compra", header_style))
    if not transactions:
        story.append(Paragraph("No registra compras de tokens.", body_style))
    else:
        table_content = [[
            Paragraph("<b>Fecha</b>", body_style),
            Paragraph("<b>Paquete</b>", body_style),
            Paragraph("<b>Tokens</b>", body_style),
            Paragraph("<b>Precio</b>", body_style),
            Paragraph("<b>Tarjeta (Últimos 4)</b>", body_style),
            Paragraph("<b>Resultado</b>", body_style)
        ]]
        for tx in transactions:
            tx_result = tx.result.value if hasattr(tx.result, "value") else str(tx.result)
            table_content.append([
                Paragraph(tx.created_at.strftime('%Y-%m-%d %H:%M:%S'), body_style),
                Paragraph(_sanitize(tx.package_name), body_style),
                Paragraph(str(tx.tokens_amount), body_style),
                Paragraph(f"${tx.price_cop} COP", body_style),
                Paragraph(f"**** **** **** {tx.last_four_used or 'N/A'}", body_style),
                Paragraph(f"<font color='{'green' if tx_result == 'aprobada' else 'red'}'>{_sanitize(tx_result)}</font>", body_style)
            ])
        t_txs = Table(table_content, colWidths=[110, 80, 50, 80, 120, 100])
        t_txs.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t_txs)

    # 4. Owned Items/Inventory
    story.append(Paragraph("4. Inventario de Artículos de Juego Adquiridos", header_style))
    if not items:
        story.append(Paragraph("No registra artículos de juego comprados.", body_style))
    else:
        table_content = [[
            Paragraph("<b>Artículo</b>", body_style),
            Paragraph("<b>Categoría</b>", body_style),
            Paragraph("<b>Precio (Tokens)</b>", body_style),
            Paragraph("<b>Fecha de Adquisición</b>", body_style)
        ]]
        for it in items:
            table_content.append([
                Paragraph(_sanitize(it.item.name), body_style),
                Paragraph(_sanitize(it.item.category.upper()), body_style),
                Paragraph(str(it.item.price_tokens), body_style),
                Paragraph(it.acquired_at.strftime('%Y-%m-%d %H:%M:%S'), body_style)
            ])
        t_items = Table(table_content, colWidths=[150, 100, 100, 190])
        t_items.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(t_items)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
