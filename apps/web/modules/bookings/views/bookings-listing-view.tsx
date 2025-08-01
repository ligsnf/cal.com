"use client";

import { useReactTable, getCoreRowModel, getSortedRowModel, createColumnHelper } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef } from "react";

import { WipeMyCalActionButton } from "@calcom/app-store/wipemycalother/components";
import dayjs from "@calcom/dayjs";
import {
  useDataTable,
  DataTableProvider,
  DataTableWrapper,
  DataTableFilters,
  DataTableSegment,
  ColumnFilterType,
  useFilterValue,
  ZMultiSelectFilterValue,
  ZDateRangeFilterValue,
  ZTextFilterValue,
} from "@calcom/features/data-table";
import { useSegments } from "@calcom/features/data-table/hooks/useSegments";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { Alert } from "@calcom/ui/components/alert";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import type { HorizontalTabItemProps } from "@calcom/ui/components/navigation";
import { HorizontalTabs } from "@calcom/ui/components/navigation";
import type { VerticalTabItemProps } from "@calcom/ui/components/navigation";

import BookingListItem from "@components/booking/BookingListItem";
import SkeletonLoader from "@components/booking/SkeletonLoader";

import { useFacetedUniqueValues } from "~/bookings/hooks/useFacetedUniqueValues";
import type { validStatuses } from "~/bookings/lib/validStatuses";

type BookingListingStatus = (typeof validStatuses)[number];
type BookingOutput = RouterOutputs["viewer"]["bookings"]["get"]["bookings"][0];

type RecurringInfo = {
  recurringEventId: string | null;
  count: number;
  firstDate: Date | null;
  bookings: { [key: string]: Date[] };
};

const descriptionByStatus: Record<BookingListingStatus, string> = {
  upcoming: "upcoming_bookings",
  recurring: "recurring_bookings",
  past: "past_bookings",
  cancelled: "cancelled_bookings",
  unconfirmed: "unconfirmed_bookings",
};

type BookingsProps = {
  status: (typeof validStatuses)[number];
};

export default function Bookings(props: BookingsProps) {
  return (
    <DataTableProvider useSegments={useSegments}>
      <BookingsContent {...props} />
    </DataTableProvider>
  );
}

type RowData =
  | {
      type: "data";
      booking: BookingOutput;
      isToday: boolean;
      recurringInfo?: RecurringInfo;
    }
  | {
      type: "today" | "next";
    };

function BookingsContent({ status }: BookingsProps) {
  const { t } = useLocale();
  const user = useMeQuery().data;
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // Generate dynamic tabs that preserve query parameters
  const tabs: (VerticalTabItemProps | HorizontalTabItemProps)[] = useMemo(() => {
    const queryString = searchParams?.toString() || "";

    const baseTabConfigs = [
      {
        name: "upcoming",
        path: "/bookings/upcoming",
        "data-testid": "upcoming",
      },
      {
        name: "unconfirmed",
        path: "/bookings/unconfirmed",
        "data-testid": "unconfirmed",
      },
      {
        name: "recurring",
        path: "/bookings/recurring",
        "data-testid": "recurring",
      },
      {
        name: "past",
        path: "/bookings/past",
        "data-testid": "past",
      },
      {
        name: "cancelled",
        path: "/bookings/cancelled",
        "data-testid": "cancelled",
      },
    ];

    return baseTabConfigs.map((tabConfig) => ({
      name: tabConfig.name,
      href: queryString ? `${tabConfig.path}?${queryString}` : tabConfig.path,
      "data-testid": tabConfig["data-testid"],
    }));
  }, [searchParams?.toString()]);

  const eventTypeIds = useFilterValue("eventTypeId", ZMultiSelectFilterValue)?.data as number[] | undefined;
  const teamIds = useFilterValue("teamId", ZMultiSelectFilterValue)?.data as number[] | undefined;
  const userIds = useFilterValue("userId", ZMultiSelectFilterValue)?.data as number[] | undefined;
  const dateRange = useFilterValue("dateRange", ZDateRangeFilterValue)?.data;
  const attendeeName = useFilterValue("attendeeName", ZTextFilterValue);
  const attendeeEmail = useFilterValue("attendeeEmail", ZTextFilterValue);
  const bookingUid = useFilterValue("bookingUid", ZTextFilterValue)?.data?.operand as string | undefined;

  const { limit, offset } = useDataTable();

  const query = trpc.viewer.bookings.get.useQuery({
    limit,
    offset,
    filters: {
      status,
      eventTypeIds,
      teamIds,
      userIds,
      attendeeName,
      attendeeEmail,
      bookingUid,
      afterStartDate: dateRange?.startDate
        ? dayjs(dateRange?.startDate).startOf("day").toISOString()
        : undefined,
      beforeEndDate: dateRange?.endDate ? dayjs(dateRange?.endDate).endOf("day").toISOString() : undefined,
    },
  });

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<RowData>();

    return [
      columnHelper.accessor((row) => row.type === "data" && row.booking.eventType.id, {
        id: "eventTypeId",
        header: t("event_type"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.MULTI_SELECT,
          },
        },
      }),
      columnHelper.accessor((row) => row.type === "data" && row.booking.eventType.team?.id, {
        id: "teamId",
        header: t("team"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.MULTI_SELECT,
          },
        },
      }),
      columnHelper.accessor((row) => row.type === "data" && row.booking.user?.id, {
        id: "userId",
        header: t("member"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.MULTI_SELECT,
          },
        },
      }),
      columnHelper.accessor((row) => row, {
        id: "attendeeName",
        header: t("attendee_name"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.TEXT,
          },
        },
      }),
      columnHelper.accessor((row) => row, {
        id: "attendeeEmail",
        header: t("attendee_email_variable"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.TEXT,
          },
        },
      }),
      columnHelper.accessor((row) => row, {
        id: "dateRange",
        header: t("date_range"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.DATE_RANGE,
            dateRangeOptions: {
              range: status === "past" ? "past" : "custom",
            },
          },
        },
      }),
      columnHelper.accessor((row) => row.type === "data" && row.booking.uid, {
        id: "bookingUid",
        header: t("booking_uid"),
        enableColumnFilter: true,
        enableSorting: false,
        cell: () => null,
        meta: {
          filter: {
            type: ColumnFilterType.TEXT,
            textOptions: {
              allowedOperators: ["equals"],
            },
          },
        },
      }),
      columnHelper.display({
        id: "customView",
        cell: (props) => {
          if (props.row.original.type === "data") {
            const { booking, recurringInfo, isToday } = props.row.original;
            return (
              <BookingListItem
                key={booking.id}
                isToday={isToday}
                loggedInUser={{
                  userId: user?.id,
                  userTimeZone: user?.timeZone,
                  userTimeFormat: user?.timeFormat,
                  userEmail: user?.email,
                }}
                listingStatus={status}
                recurringInfo={recurringInfo}
                {...booking}
              />
            );
          } else if (props.row.original.type === "today") {
            return (
              <p className="text-subtle bg-subtle w-full py-4 pl-6 text-xs font-semibold uppercase leading-4">
                {t("today")}
              </p>
            );
          } else if (props.row.original.type === "next") {
            return (
              <p className="text-subtle bg-subtle w-full py-4 pl-6 text-xs font-semibold uppercase leading-4">
                {t("next")}
              </p>
            );
          }
        },
      }),
    ];
  }, [user, status, t]);

  const isEmpty = useMemo(() => !query.data?.bookings.length, [query.data]);

  const flatData = useMemo<RowData[]>(() => {
    const shownBookings: Record<string, BookingOutput[]> = {};
    const filterBookings = (booking: BookingOutput) => {
      if (status === "recurring" || status == "unconfirmed" || status === "cancelled") {
        if (!booking.recurringEventId) {
          return true;
        }
        if (
          shownBookings[booking.recurringEventId] !== undefined &&
          shownBookings[booking.recurringEventId].length > 0
        ) {
          shownBookings[booking.recurringEventId].push(booking);
          return false;
        }
        shownBookings[booking.recurringEventId] = [booking];
      } else if (status === "upcoming") {
        return (
          dayjs(booking.startTime).tz(user?.timeZone).format("YYYY-MM-DD") !==
          dayjs().tz(user?.timeZone).format("YYYY-MM-DD")
        );
      }
      return true;
    };

    return (
      query.data?.bookings.filter(filterBookings).map((booking) => ({
        type: "data",
        booking,
        recurringInfo: query.data?.recurringInfo.find(
          (info) => info.recurringEventId === booking.recurringEventId
        ),
        isToday: false,
      })) || []
    );
  }, [query.data]);

  const bookingsToday = useMemo<RowData[]>(() => {
    return (
      query.data?.bookings
        .filter(
          (booking: BookingOutput) =>
            dayjs(booking.startTime).tz(user?.timeZone).format("YYYY-MM-DD") ===
            dayjs().tz(user?.timeZone).format("YYYY-MM-DD")
        )
        .map((booking) => ({
          type: "data" as const,
          booking,
          recurringInfo: query.data?.recurringInfo.find(
            (info) => info.recurringEventId === booking.recurringEventId
          ),
          isToday: true,
        })) ?? []
    );
  }, [query.data]);

  const finalData = useMemo<RowData[]>(() => {
    if (status !== "upcoming") {
      return flatData;
    }
    const merged: RowData[] = [];
    if (bookingsToday.length > 0) {
      merged.push({ type: "today" as const }, ...bookingsToday);
    }
    if (flatData.length > 0) {
      merged.push({ type: "next" as const }, ...flatData);
    }
    return merged;
  }, [bookingsToday, flatData, status]);

  const getFacetedUniqueValues = useFacetedUniqueValues();

  const table = useReactTable<RowData>({
    data: finalData,
    columns,
    initialState: {
      columnVisibility: {
        eventTypeId: false,
        teamId: false,
        userId: false,
        attendeeName: false,
        attendeeEmail: false,
        dateRange: false,
        bookingUid: false,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedUniqueValues,
  });

  return (
    <div className="flex flex-col">
      <div className="flex flex-row flex-wrap justify-between">
        <HorizontalTabs
          tabs={tabs.map((tab) => ({
            ...tab,
            name: t(tab.name),
          }))}
        />
      </div>
      <main className="w-full">
        <div className="flex w-full flex-col">
          {query.status === "error" && (
            <Alert severity="error" title={t("something_went_wrong")} message={query.error.message} />
          )}
          {query.status !== "error" && (
            <>
              {!!bookingsToday.length && status === "upcoming" && (
                <WipeMyCalActionButton bookingStatus={status} bookingsEmpty={isEmpty} />
              )}
              <DataTableWrapper
                className="mb-6"
                tableContainerRef={tableContainerRef}
                table={table}
                testId={`${status}-bookings`}
                bodyTestId="bookings"
                headerClassName="hidden"
                isPending={query.isPending}
                totalRowCount={query.data?.totalCount}
                variant="compact"
                paginationMode="standard"
                ToolbarLeft={
                  <>
                    <DataTableFilters.FilterBar table={table} />
                  </>
                }
                ToolbarRight={
                  <>
                    <DataTableFilters.ClearFiltersButton />
                    <DataTableSegment.SaveButton />
                    <DataTableSegment.Select />
                  </>
                }
                LoaderView={<SkeletonLoader />}
                EmptyView={
                  <div className="flex items-center justify-center pt-2 xl:pt-0">
                    <EmptyScreen
                      Icon="calendar"
                      headline={t("no_status_bookings_yet", { status: t(status).toLowerCase() })}
                      description={t("no_status_bookings_yet_description", {
                        status: t(status).toLowerCase(),
                        description: t(descriptionByStatus[status]),
                      })}
                    />
                  </div>
                }
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
