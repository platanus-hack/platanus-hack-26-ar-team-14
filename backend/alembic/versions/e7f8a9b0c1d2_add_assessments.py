"""add assessments and derived OA metrics

Revision ID: e7f8a9b0c1d2
Revises: d8e9f0a1b2c3
Create Date: 2026-05-10 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "d8e9f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assessments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("record_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "status", sa.String(length=32), nullable=False, server_default="ready"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["record_id"], ["class_learning_records.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assessments_course_id"), "assessments", ["course_id"])
    op.create_index(op.f("ix_assessments_record_id"), "assessments", ["record_id"])

    op.create_table(
        "assessment_artifacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["assessments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_assessment_artifacts_assessment_id"),
        "assessment_artifacts",
        ["assessment_id"],
    )

    op.create_table(
        "assessment_questions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("score_key", sa.String(length=32), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("oa_codes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("max_points", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["assessments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_assessment_questions_assessment_id"),
        "assessment_questions",
        ["assessment_id"],
    )
    op.create_index(
        op.f("ix_assessment_questions_ordinal"),
        "assessment_questions",
        ["ordinal"],
    )

    op.create_table(
        "assessment_result_rows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("student_name", sa.String(length=255), nullable=False),
        sa.Column("question_scores", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("total_score", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["assessments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_assessment_result_rows_assessment_id"),
        "assessment_result_rows",
        ["assessment_id"],
    )

    op.create_table(
        "assessment_oa_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("oa_code", sa.String(length=16), nullable=False),
        sa.Column("question_ordinals", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("mastery_pct", sa.Float(), nullable=False),
        sa.Column("average_score", sa.Float(), nullable=False),
        sa.Column("max_score", sa.Float(), nullable=False),
        sa.Column("student_count", sa.Integer(), nullable=False),
        sa.Column(
            "weak",
            sa.Boolean(),
            nullable=False,
            server_default=sa.sql.expression.false(),
        ),
        sa.Column("evidence_summary", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["assessments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_assessment_oa_metrics_assessment_id"),
        "assessment_oa_metrics",
        ["assessment_id"],
    )
    op.create_index(
        op.f("ix_assessment_oa_metrics_oa_code"),
        "assessment_oa_metrics",
        ["oa_code"],
    )
    op.create_index(
        op.f("ix_assessment_oa_metrics_weak"),
        "assessment_oa_metrics",
        ["weak"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_assessment_oa_metrics_weak"), table_name="assessment_oa_metrics"
    )
    op.drop_index(
        op.f("ix_assessment_oa_metrics_oa_code"), table_name="assessment_oa_metrics"
    )
    op.drop_index(
        op.f("ix_assessment_oa_metrics_assessment_id"),
        table_name="assessment_oa_metrics",
    )
    op.drop_table("assessment_oa_metrics")

    op.drop_index(
        op.f("ix_assessment_result_rows_assessment_id"),
        table_name="assessment_result_rows",
    )
    op.drop_table("assessment_result_rows")

    op.drop_index(
        op.f("ix_assessment_questions_ordinal"),
        table_name="assessment_questions",
    )
    op.drop_index(
        op.f("ix_assessment_questions_assessment_id"),
        table_name="assessment_questions",
    )
    op.drop_table("assessment_questions")

    op.drop_index(
        op.f("ix_assessment_artifacts_assessment_id"),
        table_name="assessment_artifacts",
    )
    op.drop_table("assessment_artifacts")

    op.drop_index(op.f("ix_assessments_record_id"), table_name="assessments")
    op.drop_index(op.f("ix_assessments_course_id"), table_name="assessments")
    op.drop_table("assessments")
