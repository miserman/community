skip_if_not(
  dir.exists("../../dataverse_test") || grepl("R_LIBS", getwd(), fixed = TRUE),
  "not retrieving info"
)

test_that("downloads and saves the file appropriately", {
  meta <- download_dataverse_info("doi:10.18130/V3/SWK71R")
  meta$latestVersion <- NULL
  expect_true(meta$id == 880)
  expect_identical(
    jsonlite::read_json(paste0(tempdir(), "/1018130V3SWK71R.json")),
    meta
  )
})

# test_that("works with github id", {
#   meta <- download_dataverse_info("uva-bi-sdad/dc.arlingtoncounty.parks")
#   meta$latestVersion <- NULL
#   expect_true(meta$id == 919)
#   expect_identical(
#     jsonlite::read_json(paste0(tempdir(), "/1018130V3GMIVZZ.json")),
#     meta
#   )
# })

test_that("unpublished sets are accessible with a key", {
  skip_if(Sys.getenv("DATAVERSE_KEY") == "", "no key available")
  expect_error(suppressWarnings(download_dataverse_info(
    "doi:10.18130/V3/GO64UN",
    key = FALSE
  )))
  meta <- download_dataverse_info("doi:10.18130/V3/GO64UN")
  meta$latestVersion <- NULL
  expect_true(meta$id == 918)
  expect_identical(
    jsonlite::read_json(paste0(tempdir(), "/1018130V3GO64UN.json")),
    meta
  )
})
