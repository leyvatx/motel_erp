from __future__ import annotations

import csv
from decimal import Decimal

from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reports import services
from apps.users.constants import PermissionCode


def _csv_safe(value) -> str:
    if isinstance(value, (int, float, Decimal)):
        return str(value)
    text = str(value or "")
    return f"'{text}" if text.startswith(("=", "+", "-", "@")) else text


class ReportView(APIView):
    required_permissions = {"*": [PermissionCode.REPORT_VIEW]}
    throttle_scope = "reports"
    report_function = None
    rows_key = "daily"

    def get(self, request):
        data = self.report_function(request.query_params)
        if request.query_params.get("export") == "csv":
            return self.csv_response(data)
        return Response(data)

    def csv_response(self, data: dict) -> HttpResponse:
        rows = data.get(self.rows_key, [])
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="reporte.csv"'
        response.write("\ufeff")
        writer = csv.writer(response)
        if rows:
            writer.writerow(rows[0].keys())
            for row in rows:
                writer.writerow(_csv_safe(value) for value in row.values())
        return response


class OccupancyReportView(ReportView):
    report_function = staticmethod(services.occupancy_report)


class RevenueReportView(ReportView):
    report_function = staticmethod(services.revenue_report)


class ProductsReportView(ReportView):
    report_function = staticmethod(services.products_report)
    rows_key = "products"


class ShiftsReportView(ReportView):
    report_function = staticmethod(services.shifts_report)
    rows_key = "shifts"


class HousekeepingReportView(ReportView):
    report_function = staticmethod(services.housekeeping_report)
    rows_key = "employees"
