from app.ingestion import _table_to_markdown


def test_table_to_markdown_formats_rows() -> None:
    table = [
        ["Name", "Value"],
        ["Needle", "0.45"],
        ["Syringe", "5 ml"],
    ]

    assert _table_to_markdown(table) == (
        "| Name | Value |\n| --- | --- |\n| Needle | 0.45 |\n| Syringe | 5 ml |"
    )


def test_table_to_markdown_handles_empty_table() -> None:
    assert _table_to_markdown([]) == ""
