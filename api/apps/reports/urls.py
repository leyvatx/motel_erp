from django.urls import path

from apps.reports.views import (
    HousekeepingReportView,
    OccupancyReportView,
    ProductsReportView,
    RevenueReportView,
    ShiftsReportView,
)

urlpatterns = [
    path("occupancy/", OccupancyReportView.as_view(), name="occupancy"),
    path("revenue/", RevenueReportView.as_view(), name="revenue"),
    path("products/", ProductsReportView.as_view(), name="products"),
    path("shifts/", ShiftsReportView.as_view(), name="shifts"),
    path("housekeeping/", HousekeepingReportView.as_view(), name="housekeeping"),
]
