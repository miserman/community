dir <- "../../dataverse_test"
if (grepl("R_LIBS", getwd(), fixed = TRUE)) dir.create(dir, FALSE, TRUE)
if (!dir.exists(dir)) dir <- "../../../../dataverse_test"
skip_if_not(dir.exists(dir), "not downloading data")

test_that("downloads and processes files", {
  d <- download_dataverse_data(
    "doi:10.18130/V3/NAZO4B",
    dir,
    files = 11,
    server = "dataverse.lib.virginia.edu"
  )
  # expect_true(file.exists(paste0(
  #   dir,
  #   "/dc_bl_abc_2021_address_block_counts.csv.xz"
  # )))
  expect_identical(
    d,
    download_dataverse_data(
      "doi:10.18130/V3/NAZO4B",
      dir,
      files = "dc_bl_abc_2021_address_block_counts"
    )
  )
})

test_that("unpublished sets are accessible with a key", {
  skip_if(Sys.getenv("DATAVERSE_KEY") == "", "no key available")
  expect_error(suppressWarnings(
    download_dataverse_data(
      "doi:10.18130/V3/GMIVZZ",
      dir,
      files = 1,
      server = "dataverse.lib.virginia.edu",
      key = FALSE
    )
  ))
  d <- download_dataverse_data(
    "doi:10.18130/V3/GMIVZZ",
    dir,
    files = 1,
    server = "dataverse.lib.virginia.edu"
  )
  expect_true(file.exists(paste0(
    dir,
    "/va013_trbg_arlopendata_2021_parks_catchment_scores.csv.xz"
  )))
  expect_identical(
    d,
    download_dataverse_data(
      "doi:10.18130/V3/GMIVZZ",
      dir,
      files = "va013_trbg_arlopendata_2021_parks_catchment_scores"
    )
  )
})
